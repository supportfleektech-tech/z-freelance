import { eq, inArray } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import {
  clientProfiles,
  freelancerProfiles,
  users,
  wallets,
  type ClientProfile,
  type FreelancerProfile,
  type User,
} from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { ApiError, isUniqueViolation } from "@/lib/api/http";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { ensureSkills, setFreelancerSkills } from "./taxonomy.service";
import { slugify } from "@/lib/utils";
import type {
  RegisterInput,
  UpdateClientProfileInput,
  UpdateFreelancerProfileInput,
} from "@/lib/validation";
import { notify } from "./notification.service";

/** Rows that are always created alongside a user account. */
async function provisionProfile(tx: Tx, user: User): Promise<void> {
  if (user.role === "FREELANCER") {
    await tx.insert(freelancerProfiles).values({ userId: user.id });
  } else {
    await tx.insert(clientProfiles).values({ userId: user.id });
  }
  await tx.insert(wallets).values({ userId: user.id, balanceCents: 0, pendingCents: 0 });
}

/**
 * Create an account together with its role-specific profile and wallet in a
 * single transaction, so a half-created account is impossible.
 */
export async function registerUser(input: RegisterInput): Promise<User> {
  const database = await getDb();
  const passwordHash = await hashPassword(input.password);

  try {
    const rows = await database.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
          role: input.role,
        })
        .returning();
      if (!user) throw new Error("user insert returned no row");
      await provisionProfile(tx, user);
      return [user];
    });
    return rows[0] as User;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict("An account with that email already exists.");
    }
    throw error;
  }
}

/**
 * Verify credentials.
 *
 * The same error is returned for "no such email" and "wrong password" so the
 * endpoint cannot be used to enumerate registered accounts; a dummy bcrypt
 * comparison keeps the response time similar in both cases.
 */
export async function authenticate(email: string, password: string): Promise<User> {
  const database = await getDb();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    await verifyAgainstDummy(password);
    throw ApiError.unauthorized("Incorrect email or password.");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Incorrect email or password.");

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("This account has been suspended. Contact support for details.");
  }

  await database.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ...user, lastLoginAt: new Date() };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const database = await getDb();
  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw ApiError.notFound("Account not found.");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.forbidden("Your current password is incorrect.");

  await database
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export interface ProfileBundle {
  user: User;
  freelancer: FreelancerProfile | null;
  client: ClientProfile | null;
}

/** Load a user with whichever role profile applies. */
export async function getProfileBundle(userId: string): Promise<ProfileBundle | null> {
  const database = await getDb();
  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  if (user.role === "FREELANCER") {
    const [freelancer] = await database
      .select()
      .from(freelancerProfiles)
      .where(eq(freelancerProfiles.userId, userId))
      .limit(1);
    return { user, freelancer: freelancer ?? null, client: null };
  }

  const [client] = await database
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1);
  return { user, freelancer: null, client: client ?? null };
}

/** Public view of a freelancer, including their skills. */
export async function getPublicFreelancer(profileId: string) {
  const database = await getDb();
  const rows = await database
    .select({
      profile: freelancerProfiles,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      },
    })
    .from(freelancerProfiles)
    .innerJoin(users, eq(users.id, freelancerProfiles.userId))
    .where(eq(freelancerProfiles.id, profileId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return row;
}

export async function updateFreelancerProfile(
  userId: string,
  input: UpdateFreelancerProfileInput,
): Promise<FreelancerProfile> {
  const database = await getDb();
  const [existing] = await database
    .select()
    .from(freelancerProfiles)
    .where(eq(freelancerProfiles.userId, userId))
    .limit(1);
  if (!existing) throw ApiError.notFound("Freelancer profile not found.");

  const { skills, ...fields } = input;

  const [updated] = await database
    .update(freelancerProfiles)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(freelancerProfiles.id, existing.id))
    .returning();

  if (skills) {
    await database.transaction(async (tx) => {
      const ids = await ensureSkills(tx, skills);
      await setFreelancerSkills(tx, existing.id, ids);
    });
  }

  return updated as FreelancerProfile;
}

export async function updateClientProfile(
  userId: string,
  input: UpdateClientProfileInput,
): Promise<ClientProfile> {
  const database = await getDb();
  const [existing] = await database
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1);
  if (!existing) throw ApiError.notFound("Client profile not found.");

  const [updated] = await database
    .update(clientProfiles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(clientProfiles.id, existing.id))
    .returning();

  return updated as ClientProfile;
}

/** Slugified handle used in public URLs. */
export function publicHandle(user: Pick<User, "name" | "id">): string {
  return `${slugify(user.name) || "user"}-${user.id.slice(0, 8)}`;
}

/** Guard used by admin tooling before mutating a user. */
export async function assertUserExists(userId: string): Promise<User> {
  const database = await getDb();
  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw ApiError.notFound("User not found.");
  return user;
}

/** Suspend or reinstate an account, revoking access immediately. */
export async function setUserStatus(
  actorId: string,
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
  reason?: string,
): Promise<User> {
  const database = await getDb();
  const target = await assertUserExists(userId);
  if (target.id === actorId) {
    throw ApiError.badRequest("You cannot change your own account status.");
  }

  const [updated] = await database
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (status === "SUSPENDED") {
    await notify(database, {
      userId,
      type: "ACCOUNT_SUSPENDED",
      title: "Your account has been suspended",
      body: reason ?? "Contact support if you believe this was a mistake.",
    });
  }

  return updated as User;
}

/** Look up multiple users by id (used for permission checks and listings). */
export async function findUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const database = await getDb();
  return database.select().from(users).where(inArray(users.id, ids));
}

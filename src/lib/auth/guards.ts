import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type User } from "../db/schema";
import { readSessionToken, verifySessionToken } from "./session";
import { ApiError } from "../api/http";

/**
 * Authenticated-user resolution.
 *
 * Wrapped in React's `cache()` so a single request that touches several server
 * components / helpers only pays for one token verification and one row read.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const database = await db();
  const [user] = await database.select().from(users).where(eq(users.id, payload.sub)).limit(1);

  // A deleted or suspended account is never authenticated, regardless of
  // whether its token is still cryptographically valid.
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

/** Resolve the caller or throw a 401 — use inside Route Handlers. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "unauthenticated", "You must be signed in to do that.");
  }
  return user;
}

/** Resolve the caller and assert one of the allowed roles. */
export async function requireRole(...roles: Array<User["role"]>): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "forbidden", `This action requires the ${roles.join(" or ")} role.`);
  }
  return user;
}

export function isClient(user: User | null | undefined): boolean {
  return user?.role === "CLIENT" || user?.role === "ADMIN";
}

export function isFreelancer(user: User | null | undefined): boolean {
  return user?.role === "FREELANCER" || user?.role === "ADMIN";
}

import { and, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import {
  freelancerProfiles,
  freelancerSkills,
  projects,
  proposals,
  reviews,
  skills,
  users,
  type FreelancerProfile,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { slugify } from "@/lib/utils";
import type { FreelancerQuery } from "@/lib/validation";

export interface FreelancerCard {
  profileId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  hourlyRateCents: number | null;
  country: string | null;
  city: string | null;
  availability: FreelancerProfile["availability"];
  yearsExperience: number;
  ratingAvg: number;
  ratingCount: number;
  completedContracts: number;
  totalEarnedCents: number;
  memberSince: Date;
  skills: string[];
}

function mapRows(
  rows: Array<{
    profile: FreelancerProfile;
    name: string;
    avatarUrl: string | null;
    createdAt: Date;
  }>,
  skillsByProfile: Map<string, string[]>,
): FreelancerCard[] {
  return rows.map((row) => ({
    profileId: row.profile.id,
    userId: row.profile.userId,
    name: row.name,
    avatarUrl: row.avatarUrl,
    headline: row.profile.headline,
    bio: row.profile.bio,
    hourlyRateCents: row.profile.hourlyRateCents,
    country: row.profile.country,
    city: row.profile.city,
    availability: row.profile.availability,
    yearsExperience: row.profile.yearsExperience,
    ratingAvg: Number(row.profile.ratingAvg),
    ratingCount: row.profile.ratingCount,
    completedContracts: row.profile.completedContracts,
    totalEarnedCents: Number(row.profile.totalEarnedCents),
    memberSince: row.createdAt,
    skills: skillsByProfile.get(row.profile.id) ?? [],
  }));
}

async function loadSkills(profileIds: string[]): Promise<Map<string, string[]>> {
  if (profileIds.length === 0) return new Map();
  const database = await getDb();
  const rows = await database
    .select({ profileId: freelancerSkills.profileId, name: skills.name })
    .from(freelancerSkills)
    .innerJoin(skills, eq(skills.id, freelancerSkills.skillId))
    .where(inArray(freelancerSkills.profileId, profileIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.profileId) ?? [];
    list.push(row.name);
    map.set(row.profileId, list);
  }
  return map;
}

/** Directory search across freelancer profiles. */
export async function searchFreelancers(query: FreelancerQuery) {
  const database = await getDb();
  const conditions: SQL[] = [];

  if (query.q) {
    const pattern = `%${query.q.replace(/[%_]/g, "")}%`;
    const q = or(
      sql`${freelancerProfiles.headline} ilike ${pattern}`,
      sql`${freelancerProfiles.bio} ilike ${pattern}`,
      sql`${users.name} ilike ${pattern}`,
    );
    if (q) conditions.push(q);
  }
  if (query.maxRateCents != null) {
    conditions.push(lte(freelancerProfiles.hourlyRateCents, query.maxRateCents));
  }
  if (query.minRating != null && query.minRating > 0) {
    conditions.push(gte(freelancerProfiles.ratingAvg, query.minRating));
  }
  if (query.availability) conditions.push(eq(freelancerProfiles.availability, query.availability));
  if (query.skill) {
    const slug = slugify(query.skill);
    conditions.push(
      sql`exists (
        select 1 from ${freelancerSkills} fs
        join ${skills} s on s.id = fs.skill_id
        where fs.profile_id = ${freelancerProfiles.id} and s.slug = ${slug}
      )`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.pageSize;

  const orderBy =
    query.sort === "rate_low"
      ? sql`coalesce(${freelancerProfiles.hourlyRateCents}, 0) asc`
      : query.sort === "rate_high"
        ? sql`coalesce(${freelancerProfiles.hourlyRateCents}, 0) desc`
        : query.sort === "newest"
          ? desc(freelancerProfiles.createdAt)
          : sql`${freelancerProfiles.ratingAvg} desc, ${freelancerProfiles.ratingCount} desc`;

  const [rows, totalRow] = await Promise.all([
    database
      .select({
        profile: freelancerProfiles,
        name: users.name,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(freelancerProfiles)
      .innerJoin(users, eq(users.id, freelancerProfiles.userId))
      .where(where)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset(offset),
    database
      .select({ value: sql<number>`count(*)::int` })
      .from(freelancerProfiles)
      .innerJoin(users, eq(users.id, freelancerProfiles.userId))
      .where(where),
  ]);

  const skillsByProfile = await loadSkills(rows.map((r) => r.profile.id));

  return {
    items: mapRows(rows, skillsByProfile),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow[0]?.value ?? 0,
  };
}

/** Public freelancer profile page payload. */
export async function getFreelancerPublicProfile(profileIdOrUserId: string) {
  const database = await getDb();
  const isUuid = /^[0-9a-f-]{36}$/i.test(profileIdOrUserId);

  const rows = await database
    .select({
      profile: freelancerProfiles,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(freelancerProfiles)
    .innerJoin(users, eq(users.id, freelancerProfiles.userId))
    .where(
      isUuid
        ? or(
            eq(freelancerProfiles.id, profileIdOrUserId),
            eq(freelancerProfiles.userId, profileIdOrUserId),
          )
        : sql`false`,
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [skillMap, reviewRows] = await Promise.all([
    loadSkills([row.profile.id]),
    database
      .select()
      .from(reviews)
      .where(eq(reviews.subjectId, row.profile.userId))
      .orderBy(desc(reviews.createdAt))
      .limit(10),
  ]);

  const [card] = mapRows([row], skillMap);
  if (!card) return null;

  return { ...card, reviews: reviewRows };
}

/** The signed-in freelancer's own profile row (404 if they are not a freelancer). */
export async function getOwnProfile(userId: string): Promise<FreelancerProfile> {
  const database = await getDb();
  const [profile] = await database
    .select()
    .from(freelancerProfiles)
    .where(eq(freelancerProfiles.userId, userId))
    .limit(1);
  if (!profile) throw ApiError.notFound("Freelancer profile not found.");
  return profile;
}

/** A freelancer's recent winning work — used on the public profile. */
export async function listFreelancerWork(userId: string, limit = 5) {
  const database = await getDb();
  return database
    .select({
      id: proposals.id,
      title: projects.title,
      amountCents: proposals.bidAmountCents,
      status: proposals.status,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .where(and(eq(proposals.freelancerId, userId), eq(proposals.status, "HIRED")))
    .orderBy(desc(proposals.decidedAt))
    .limit(limit);
}

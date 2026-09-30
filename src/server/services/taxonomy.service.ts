import { asc, eq, inArray, sql } from "drizzle-orm";
import { categories, freelancerSkills, skills } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db";
import { slugify } from "@/lib/utils";

/** Every category, ordered by name. Cheap enough to call per request; cached by Next. */
export async function listCategories(db: DbOrTx) {
  return db.select().from(categories).orderBy(asc(categories.name));
}

/** Skills whose slug matches any of the given names. */
export async function findSkillsByNames(db: DbOrTx, names: string[]) {
  const slugs = names.map((n) => slugify(n)).filter(Boolean);
  if (slugs.length === 0) return [];
  return db.select().from(skills).where(inArray(skills.slug, slugs));
}

/**
 * Resolve free-text skill names to skill rows, creating any that do not exist
 * yet. Runs inside the caller's transaction so a failed project save cannot
 * leave orphaned skills behind.
 */
export async function ensureSkills(tx: DbOrTx, names: string[]) {
  const unique = Array.from(
    new Map(
      names
        .map((name) => ({ name: name.trim().replace(/\s+/g, " "), slug: slugify(name) }))
        .filter((s) => s.slug.length > 0)
        .map((s) => [s.slug, s]),
    ).values(),
  );
  if (unique.length === 0) return [];

  const created = await tx
    .insert(skills)
    .values(unique.map((s) => ({ name: s.name, slug: s.slug })))
    .onConflictDoNothing({ target: skills.slug })
    .returning({ id: skills.id, slug: skills.slug });

  const known = await tx.select({ id: skills.id, slug: skills.slug }).from(skills);
  const bySlug = new Map(known.map((s) => [s.slug, s.id]));
  for (const row of created) bySlug.set(row.slug, row.id);

  return unique.map((s) => bySlug.get(s.slug)).filter((id): id is string => Boolean(id));
}

/** Attach skill rows to a freelancer profile, replacing any previous set. */
export async function setFreelancerSkills(
  tx: DbOrTx,
  profileId: string,
  skillIds: string[],
): Promise<void> {
  await tx.delete(freelancerSkills).where(eq(freelancerSkills.profileId, profileId));
  if (skillIds.length === 0) return;
  await tx.insert(freelancerSkills).values(skillIds.map((skillId) => ({ profileId, skillId })));
}

/** Usage counts used by the admin taxonomy screen. */
export async function skillUsage(db: DbOrTx, limit = 20) {
  return db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      freelancerCount: sql<number>`count(${freelancerSkills.id})::int`,
    })
    .from(skills)
    .leftJoin(freelancerSkills, eq(freelancerSkills.skillId, skills.id))
    .groupBy(skills.id)
    .orderBy(sql`count(${freelancerSkills.id}) desc`)
    .limit(limit);
}

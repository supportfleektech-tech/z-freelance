import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import {
  categories,
  clientProfiles,
  projectSkills,
  projects,
  savedProjects,
  skills,
  users,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";

/**
 * Freelancer bookmarks ("save for later").
 *
 * A saved project is private — there is deliberately no way to see what
 * someone else bookmarked, and saving doesn't notify the client.
 */

export interface SavedProjectCard {
  savedId: string;
  savedAt: Date;
  projectId: string;
  title: string;
  status: string;
  budgetType: string;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  proposalsCount: number;
  deadline: Date | null;
  categoryName: string | null;
  clientName: string;
  clientCompany: string | null;
  skillNames: string[];
}

export async function isProjectSaved(userId: string, projectId: string): Promise<boolean> {
  const database = await getDb();
  const [row] = await database
    .select({ id: savedProjects.id })
    .from(savedProjects)
    .where(and(eq(savedProjects.userId, userId), eq(savedProjects.projectId, projectId)))
    .limit(1);
  return Boolean(row);
}

/** Idempotent toggle: saving twice saves once, unsaving an unsaved row is a no-op. */
export async function setProjectSaved(
  userId: string,
  projectId: string,
  saved: boolean,
): Promise<{ saved: boolean }> {
  const database = await getDb();

  if (saved) {
    const [project] = await database
      .select({ id: projects.id, status: projects.status, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) throw ApiError.notFound("Project not found.");
    if (project.clientId === userId) {
      throw ApiError.forbidden("You cannot save your own project.");
    }
    if (project.status !== "OPEN") {
      throw ApiError.conflict("Only open projects can be saved.");
    }

    await database
      .insert(savedProjects)
      .values({ userId, projectId })
      .onConflictDoNothing({ target: [savedProjects.userId, savedProjects.projectId] });
    return { saved: true };
  }

  await database
    .delete(savedProjects)
    .where(and(eq(savedProjects.userId, userId), eq(savedProjects.projectId, projectId)));
  return { saved: false };
}

/** The freelancer's bookmark list, freshest first. */
export async function listSavedProjects(userId: string): Promise<SavedProjectCard[]> {
  const database = await getDb();

  const rows = await database
    .select({
      savedId: savedProjects.id,
      savedAt: savedProjects.createdAt,
      project: projects,
      clientName: users.name,
      clientCompany: clientProfiles.companyName,
      categoryName: categories.name,
    })
    .from(savedProjects)
    .innerJoin(projects, eq(projects.id, savedProjects.projectId))
    .innerJoin(users, eq(users.id, projects.clientId))
    .leftJoin(clientProfiles, eq(clientProfiles.userId, projects.clientId))
    .leftJoin(categories, eq(categories.id, projects.categoryId))
    // Bookmarks are only creatable while OPEN; hide any whose project has
    // since drifted back to DRAFT (they stay saved and reappear if reopened).
    .where(and(eq(savedProjects.userId, userId), ne(projects.status, "DRAFT")))
    .orderBy(desc(savedProjects.createdAt));

  if (rows.length === 0) return [];

  const skillRows = await database
    .select({ projectId: projectSkills.projectId, name: skills.name })
    .from(projectSkills)
    .innerJoin(skills, eq(skills.id, projectSkills.skillId))
    .where(
      inArray(
        projectSkills.projectId,
        rows.map((r) => r.project.id),
      ),
    );

  const skillsByProject = new Map<string, string[]>();
  for (const row of skillRows) {
    const list = skillsByProject.get(row.projectId) ?? [];
    list.push(row.name);
    skillsByProject.set(row.projectId, list);
  }

  return rows.map(({ project, ...rest }) => ({
    savedId: rest.savedId,
    savedAt: rest.savedAt,
    projectId: project.id,
    title: project.title,
    status: project.status,
    budgetType: project.budgetType,
    budgetMinCents: project.budgetMinCents,
    budgetMaxCents: project.budgetMaxCents,
    proposalsCount: project.proposalsCount,
    deadline: project.deadline,
    categoryName: rest.categoryName ?? null,
    clientName: rest.clientName,
    clientCompany: rest.clientCompany ?? null,
    skillNames: skillsByProject.get(project.id) ?? [],
  }));
}

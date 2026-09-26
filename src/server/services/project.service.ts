import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db as getDb, type Tx } from "@/lib/db";
import {
  categories,
  clientProfiles,
  contracts,
  projectSkills,
  projects,
  proposals,
  skills,
  users,
  type Project,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { slugify, uniqueSlug } from "@/lib/utils";
import { ensureSkills } from "./taxonomy.service";
import { notifyMany } from "./notification.service";
import type { CreateProjectInput, ProjectQuery, UpdateProjectInput } from "@/lib/validation";

export interface ProjectWithRelations extends Project {
  clientName: string;
  clientCompany: string | null;
  clientRating: number;
  categoryName: string | null;
  categorySlug: string | null;
  skillNames: string[];
  hiredFreelancerId: string | null;
}

/* ------------------------------------------------------------------ create */

export async function createProject(clientId: string, input: CreateProjectInput): Promise<Project> {
  const database = await getDb();

  const [project] = await database.transaction(async (tx) => {
    const skillIds = await ensureSkills(tx, input.skills);

    const row = await tx
      .insert(projects)
      .values({
        clientId,
        categoryId: input.categoryId ?? null,
        title: input.title,
        slug: uniqueSlug(input.title),
        description: input.description,
        budgetType: input.budgetType,
        budgetMinCents: input.budgetMinCents ?? null,
        budgetMaxCents: input.budgetMaxCents ?? null,
        experienceLevel: input.experienceLevel,
        status: input.publish ? "OPEN" : "DRAFT",
        deadline: input.deadline ?? null,
        publishedAt: input.publish ? new Date() : null,
      })
      .returning();

    if (skillIds.length > 0) {
      const created = row[0];
      if (!created) throw new Error("project insert returned no row");
      await tx
        .insert(projectSkills)
        .values(skillIds.map((skillId) => ({ projectId: created.id, skillId })));
    }

    return row;
  });

  if (!project) throw new Error("project insert returned no row");
  return project;
}

/* ------------------------------------------------------------------ update */

export async function updateProject(
  projectId: string,
  actorId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const database = await getDb();
  const project = await mustOwnProject(projectId, actorId);

  if (project.status !== "DRAFT") {
    throw ApiError.conflict("Only draft projects can be edited. Close or cancel it instead.");
  }

  const [updated] = await database.transaction(async (tx) => {
    if (input.skills) {
      await tx.delete(projectSkills).where(eq(projectSkills.projectId, projectId));
      const skillIds = await ensureSkills(tx, input.skills);
      if (skillIds.length > 0) {
        await tx.insert(projectSkills).values(skillIds.map((skillId) => ({ projectId, skillId })));
      }
    }

    const { skills: _ignored, ...fields } = input;
    return tx
      .update(projects)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
  });

  return updated as Project;
}

/** Publish a draft, close a live project, or cancel it. */
export async function transitionProject(
  projectId: string,
  actorId: string,
  action: "PUBLISH" | "CLOSE" | "CANCEL",
): Promise<Project> {
  const database = await getDb();
  const project = await mustOwnProject(projectId, actorId);
  const now = new Date();

  switch (action) {
    case "PUBLISH": {
      if (project.status !== "DRAFT") throw ApiError.conflict("Only drafts can be published.");
      const [updated] = await database
        .update(projects)
        .set({ status: "OPEN", publishedAt: now, updatedAt: now })
        .where(eq(projects.id, projectId))
        .returning();
      return updated as Project;
    }
    case "CLOSE": {
      if (project.status !== "OPEN" && project.status !== "IN_PROGRESS") {
        throw ApiError.conflict("Only open or in-progress projects can be closed.");
      }
      const [updated] = await database
        .update(projects)
        .set({ status: "CLOSED", closedAt: now, updatedAt: now })
        .where(eq(projects.id, projectId))
        .returning();
      return updated as Project;
    }
    case "CANCEL": {
      // A project with a live contract cannot be cancelled out from under the freelancer.
      const live = await database
        .select({ id: contracts.id })
        .from(contracts)
        .where(and(eq(contracts.projectId, projectId), eq(contracts.status, "ACTIVE")))
        .limit(1);
      if (live.length > 0) {
        throw ApiError.conflict(
          "This project has an active contract. Cancel the contract before cancelling the project.",
        );
      }
      const [updated] = await database
        .update(projects)
        .set({ status: "CANCELLED", closedAt: now, updatedAt: now })
        .where(eq(projects.id, projectId))
        .returning();
      return updated as Project;
    }
    default:
      throw ApiError.badRequest(`Unknown project action: ${String(action)}`);
  }
}

/* -------------------------------------------------------------------- read */

/** Fetch a project by id (or slug) with everything the detail page needs. */
export async function getProjectDetail(
  idOrSlug: string,
  options: { viewerId?: string | null; countView?: boolean } = {},
): Promise<ProjectWithRelations | null> {
  const database = await getDb();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const rows = await database
    .select({
      project: projects,
      clientName: users.name,
      clientCompany: clientProfiles.companyName,
      clientRating: clientProfiles.ratingAvg,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.clientId))
    .leftJoin(clientProfiles, eq(clientProfiles.userId, projects.clientId))
    .leftJoin(categories, eq(categories.id, projects.categoryId))
    .where(isUuid ? eq(projects.id, idOrSlug) : eq(projects.slug, idOrSlug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [skillRows, contractRows] = await Promise.all([
    database
      .select({ name: skills.name })
      .from(projectSkills)
      .innerJoin(skills, eq(skills.id, projectSkills.skillId))
      .where(eq(projectSkills.projectId, row.project.id)),
    database
      .select({ freelancerId: contracts.freelancerId })
      .from(contracts)
      .where(eq(contracts.projectId, row.project.id))
      .limit(1),
  ]);

  const isOwner = options.viewerId != null && options.viewerId === row.project.clientId;
  if (options.countView && !isOwner) {
    await database
      .update(projects)
      .set({ viewsCount: sql`${projects.viewsCount} + 1` })
      .where(eq(projects.id, row.project.id));
  }

  return {
    ...row.project,
    clientName: row.clientName,
    clientCompany: row.clientCompany ?? null,
    clientRating: row.clientRating ?? 0,
    categoryName: row.categoryName ?? null,
    categorySlug: row.categorySlug ?? null,
    skillNames: skillRows.map((s) => s.name),
    hiredFreelancerId: contractRows[0]?.freelancerId ?? null,
  };
}

export interface ProjectSearchResult {
  items: ProjectWithRelations[];
  page: number;
  pageSize: number;
  total: number;
}

/** Public marketplace search with filters, sorting and pagination. */
export async function searchProjects(query: ProjectQuery): Promise<ProjectSearchResult> {
  const database = await getDb();
  const conditions = [eq(projects.status, query.status ?? "OPEN")];

  if (query.q) {
    const pattern = `%${query.q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(sql`${projects.title} ilike ${pattern}`, sql`${projects.description} ilike ${pattern}`) ??
        sql`true`,
    );
  }
  if (query.categoryId) conditions.push(eq(projects.categoryId, query.categoryId));
  if (query.budgetType) conditions.push(eq(projects.budgetType, query.budgetType));
  if (query.experienceLevel) conditions.push(eq(projects.experienceLevel, query.experienceLevel));
  if (query.budgetMinCents != null) {
    conditions.push(
      sql`coalesce(${projects.budgetMaxCents}, ${projects.budgetMinCents}) >= ${query.budgetMinCents}`,
    );
  }
  if (query.budgetMaxCents != null) {
    conditions.push(
      sql`coalesce(${projects.budgetMinCents}, ${projects.budgetMaxCents}) <= ${query.budgetMaxCents}`,
    );
  }
  if (query.skill) {
    const skillSlug = slugify(query.skill);
    conditions.push(
      sql`exists (
        select 1 from ${projectSkills} ps
        join ${skills} s on s.id = ps.skill_id
        where ps.project_id = ${projects.id} and s.slug = ${skillSlug}
      )`,
    );
  }

  const where = and(...conditions);
  const offset = (query.page - 1) * query.pageSize;

  const orderBy =
    query.sort === "budget_high"
      ? desc(sql`coalesce(${projects.budgetMaxCents}, 0)`)
      : query.sort === "budget_low"
        ? sql`coalesce(${projects.budgetMinCents}, 0) asc`
        : query.sort === "proposals"
          ? desc(projects.proposalsCount)
          : desc(projects.publishedAt);

  const [rows, totalRow] = await Promise.all([
    database
      .select({
        project: projects,
        clientName: users.name,
        clientCompany: clientProfiles.companyName,
        clientRating: clientProfiles.ratingAvg,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.clientId))
      .leftJoin(clientProfiles, eq(clientProfiles.userId, projects.clientId))
      .leftJoin(categories, eq(categories.id, projects.categoryId))
      .where(where)
      .orderBy(orderBy)
      .limit(query.pageSize)
      .offset(offset),
    database
      .select({ value: sql<number>`count(*)::int` })
      .from(projects)
      .where(where),
  ]);

  const projectIds = rows.map((r) => r.project.id);
  const skillRows =
    projectIds.length > 0
      ? await database
          .select({ projectId: projectSkills.projectId, name: skills.name })
          .from(projectSkills)
          .innerJoin(skills, eq(skills.id, projectSkills.skillId))
          .where(inArray(projectSkills.projectId, projectIds))
      : [];

  const skillsByProject = new Map<string, string[]>();
  for (const row of skillRows) {
    const list = skillsByProject.get(row.projectId) ?? [];
    list.push(row.name);
    skillsByProject.set(row.projectId, list);
  }

  return {
    items: rows.map((row) => ({
      ...row.project,
      clientName: row.clientName,
      clientCompany: row.clientCompany ?? null,
      clientRating: row.clientRating ?? 0,
      categoryName: row.categoryName ?? null,
      categorySlug: row.categorySlug ?? null,
      skillNames: skillsByProject.get(row.project.id) ?? [],
      hiredFreelancerId: null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow[0]?.value ?? 0,
  };
}

/** A client's own projects, newest first. */
export async function listClientProjects(clientId: string) {
  const database = await getDb();
  return database
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.createdAt));
}

/** Load a project and assert the actor is its owner. */
export async function mustOwnProject(projectId: string, actorId: string): Promise<Project> {
  const database = await getDb();
  const [project] = await database
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw ApiError.notFound("Project not found.");
  if (project.clientId !== actorId) throw ApiError.forbidden("You do not own this project.");
  return project;
}

/** Keep the denormalised proposal counter in sync (called from proposal writes). */
export async function refreshProposalCount(tx: Tx, projectId: string): Promise<void> {
  await tx
    .update(projects)
    .set({
      proposalsCount: sql`(select count(*)::int from ${proposals} where project_id = ${projectId} and status <> 'WITHDRAWN')`,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}

/** Mark a project as having an active contract (called when a freelancer is hired). */
export async function markProjectInProgress(tx: Tx, projectId: string): Promise<void> {
  await tx
    .update(projects)
    .set({ status: "IN_PROGRESS", updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), ne(projects.status, "CLOSED")));
}

/** True when at least one contract for the project is not cancelled. */
export async function hasActiveContract(projectId: string): Promise<boolean> {
  const database = await getDb();
  const rows = await database
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      and(
        eq(contracts.projectId, projectId),
        inArray(contracts.status, ["ACTIVE", "COMPLETED", "DISPUTED"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Notify every shortlisted freelancer about an outcome — used on hire. */
export async function notifyNonHiredProposers(
  tx: Tx,
  projectId: string,
  hiredProposalId: string,
  projectTitle: string,
): Promise<void> {
  const others = await tx
    .select({ id: proposals.id, freelancerId: proposals.freelancerId })
    .from(proposals)
    .where(
      and(
        eq(proposals.projectId, projectId),
        ne(proposals.id, hiredProposalId),
        inArray(proposals.status, ["PENDING", "SHORTLISTED"]),
      ),
    );

  if (others.length === 0) return;

  await tx
    .update(proposals)
    .set({ status: "REJECTED", decidedAt: new Date(), updatedAt: new Date() })
    .where(
      inArray(
        proposals.id,
        others.map((o) => o.id),
      ),
    );

  await notifyMany(
    tx,
    others.map((o) => ({
      userId: o.freelancerId,
      type: "PROPOSAL_REJECTED" as const,
      title: "A client chose another freelancer",
      body: `Your proposal for “${projectTitle}” was not selected this time.`,
      link: "/dashboard/proposals",
    })),
  );
}

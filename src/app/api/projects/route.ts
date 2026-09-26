import type { NextRequest } from "next/server";
import { created, ok, parseBody, parseQuery, route, throttle } from "@/lib/api/http";
import { createProjectSchema, projectQuerySchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { createProject, searchProjects } from "@/server/services/project.service";
import { listCategories } from "@/server/services/taxonomy.service";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects — public marketplace search.
 * POST /api/projects — clients create a project (draft or published).
 */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "projects:search");

  const query = parseQuery(request, projectQuerySchema);
  const [result, categories] = await Promise.all([
    searchProjects(query),
    listCategories(await getDb()),
  ]);

  return ok({ ...result, categories });
});

export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "projects:create");

  const client = await requireRole("CLIENT", "ADMIN");
  const input = await parseBody(request, createProjectSchema);
  const project = await createProject(client.id, input);

  return created(project, `/api/projects/${project.id}`);
});

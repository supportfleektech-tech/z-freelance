import type { NextRequest } from "next/server";
import { ApiError, ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, updateProjectSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProjectDetail, mustOwnProject, updateProject } from "@/server/services/project.service";
import { listProposalsForProject } from "@/server/services/proposal.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id — public detail.
 * Returns proposals too, but only to the project owner.
 */
export const GET = route(async (request: NextRequest, context: Params) => {
  throttle(request, "api", "projects:read");

  const { id } = await parseParams(context.params, idParamSchema);
  const user = await getCurrentUser();

  const project = await getProjectDetail(id, { viewerId: user?.id, countView: true });
  if (!project) throw ApiError.notFound("Project not found.");

  const isOwner = user?.id === project.clientId;
  const proposals = isOwner ? await listProposalsForProject(project.id) : [];

  return ok({ project, proposals, viewer: { isOwner, isSignedIn: Boolean(user) } });
});

/** PATCH /api/projects/:id — edit a draft. */
export const PATCH = route(async (request: NextRequest, context: Params) => {
  throttle(request, "api", "projects:write");

  const { id } = await parseParams(context.params, idParamSchema);
  const user = await requireOwner(id);
  const input = await parseBody(request, updateProjectSchema);

  return ok({ project: await updateProject(id, user.id, input) });
});

async function requireOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthorized();
  return mustOwnProject(id, user.id).then(() => user);
}

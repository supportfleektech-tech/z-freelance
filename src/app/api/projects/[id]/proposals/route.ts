import type { NextRequest } from "next/server";
import { ApiError, created, ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { createProposalSchema, idParamSchema } from "@/lib/validation";
import { getCurrentUser, requireRole } from "@/lib/auth/guards";
import { createProposal, listProposalsForProject } from "@/server/services/proposal.service";
import { mustOwnProject } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id/proposals — owner only.
 * POST /api/projects/:id/proposals — freelancers submit a bid.
 */
export const GET = route(async (request: NextRequest, context: Params) => {
  throttle(request, "api", "proposals:list");

  const { id } = await parseParams(context.params, idParamSchema);
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthorized();

  await mustOwnProject(id, user.id);
  return ok({ proposals: await listProposalsForProject(id) });
});

export const POST = route(async (request: NextRequest, context: Params) => {
  throttle(request, "api", "proposals:create");

  const { id } = await parseParams(context.params, idParamSchema);
  const freelancer = await requireRole("FREELANCER");
  const input = await parseBody(request, createProposalSchema);

  const proposal = await createProposal(freelancer.id, id, input);
  return created(proposal, `/api/proposals/${proposal.id}`);
});

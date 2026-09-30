import type { NextRequest } from "next/server";
import { created, ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { createMilestonePlanSchema, createMilestoneSchema, idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { addMilestone, setMilestonePlan } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contracts/:id/milestones
 *
 * Two shapes:
 *   { title, amountCents, ... }  -> append one milestone
 *   { milestones: [...] }        -> replace the whole plan (must total exactly
 *                                   the contract value)
 */
export const POST = route(async (request: NextRequest, context: Params) => {
  throttle(request, "api", "milestones:write");

  const { id } = await parseParams(context.params, idParamSchema);
  const client = await requireUser();

  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  const isPlan =
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { milestones?: unknown }).milestones);

  if (isPlan) {
    const plan = await parseBody(request, createMilestonePlanSchema);
    return ok({ milestones: await setMilestonePlan(id, client.id, plan.milestones) });
  }

  const input = await parseBody(request, createMilestoneSchema);
  return created(await addMilestone(id, client.id, input));
});

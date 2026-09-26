import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { fundMilestone } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** POST /api/milestones/:id/fund — client deposits into escrow. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "milestones:fund");

    const { id } = await parseParams(context.params, idParamSchema);
    const client = await requireUser();

    return ok({ milestone: await fundMilestone(id, client.id) });
  },
);

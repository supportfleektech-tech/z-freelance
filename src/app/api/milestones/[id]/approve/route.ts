import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { approveMilestone } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/milestones/:id/approve
 *
 * Approves the delivery and releases escrow in the same transaction: the fee
 * and the net payout are written to the ledger and the freelancer's wallet is
 * credited atomically.
 */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "strict", "milestones:approve");

    const { id } = await parseParams(context.params, idParamSchema);
    const client = await requireUser();

    return ok({ milestone: await approveMilestone(id, client.id) });
  },
);

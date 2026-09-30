import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, proposalDecisionSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { decideProposal } from "@/server/services/proposal.service";
import { hireFromProposal } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/:id/decision
 *
 * `SHORTLIST` / `REJECT` update the proposal. `HIRE` is a money-moving action:
 * it opens a contract, rejects the other proposals and starts the workspace
 * thread — all in a single transaction.
 */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "proposals:decide");

    const { id } = await parseParams(context.params, idParamSchema);
    const client = await requireUser();
    const { decision } = await parseBody(request, proposalDecisionSchema);

    if (decision === "HIRE") {
      const contract = await hireFromProposal(id, client.id);
      return ok({ hired: true, contract });
    }

    const proposal = await decideProposal(id, client.id, decision);
    return ok({ hired: false, proposal });
  },
);

import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { withdrawProposal } from "@/server/services/proposal.service";

export const dynamic = "force-dynamic";

/** POST /api/proposals/:id/withdraw — freelancer takes their bid back. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "proposals:withdraw");

    const { id } = await parseParams(context.params, idParamSchema);
    const freelancer = await requireUser();

    return ok({ proposal: await withdrawProposal(id, freelancer.id) });
  },
);

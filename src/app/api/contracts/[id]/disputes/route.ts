import type { NextRequest } from "next/server";
import { created, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, openDisputeSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { openDispute } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** POST /api/contracts/:id/disputes — freeze escrow and escalate to an admin. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "disputes:open");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const input = await parseBody(request, openDisputeSchema);

    return created(await openDispute(user.id, id, input));
  },
);

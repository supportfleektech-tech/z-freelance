import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { cancelContractSchema, idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { cancelContract } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** POST /api/contracts/:id/cancel — only before money moves. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "contracts:cancel");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const input = await parseBody(request, cancelContractSchema);

    return ok({ contract: await cancelContract(id, user.id, input) });
  },
);

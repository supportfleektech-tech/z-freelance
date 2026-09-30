import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { getContractDetail } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** GET /api/contracts/:id — the contract workspace payload. */
export const GET = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "contracts:read");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();

    return ok(await getContractDetail(id, user.id));
  },
);

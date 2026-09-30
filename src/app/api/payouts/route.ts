import type { NextRequest } from "next/server";
import { created, parseBody, route, throttle } from "@/lib/api/http";
import { requestPayoutSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { requestPayout } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** POST /api/payouts — withdraw available wallet balance. */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "strict", "payouts:request");

  const freelancer = await requireRole("FREELANCER");
  const input = await parseBody(request, requestPayoutSchema);

  return created(await requestPayout(freelancer.id, input));
});

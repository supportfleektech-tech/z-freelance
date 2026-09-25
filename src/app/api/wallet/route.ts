import type { NextRequest } from "next/server";
import { ok, route, throttle } from "@/lib/api/http";
import { requireRole } from "@/lib/auth/guards";
import { getWallet, listLedger, listPayouts } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** GET /api/wallet — balance plus recent ledger entries (freelancers). */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "wallet:read");

  const user = await requireRole("FREELANCER");
  const [wallet, ledger, payouts] = await Promise.all([
    getWallet(user.id),
    listLedger(user.id),
    listPayouts(user.id),
  ]);

  return ok({ wallet, ledger, payouts });
});

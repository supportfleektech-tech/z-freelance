import type { NextRequest } from "next/server";
import { ok, route, throttle } from "@/lib/api/http";
import { requireRole } from "@/lib/auth/guards";
import { listPendingPayouts } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/payouts — withdrawal requests waiting on finance. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "admin:payouts");

  await requireRole("ADMIN");
  return ok({ payouts: await listPendingPayouts() });
});

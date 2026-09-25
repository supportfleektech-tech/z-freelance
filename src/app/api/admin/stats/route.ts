import type { NextRequest } from "next/server";
import { ok, route, throttle } from "@/lib/api/http";
import { requireRole } from "@/lib/auth/guards";
import { platformStats, recentAuditLogs } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats — platform KPIs for the admin dashboard. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "admin:stats");

  await requireRole("ADMIN");
  const [stats, audit] = await Promise.all([platformStats(), recentAuditLogs(20)]);

  return ok({ stats, audit });
});

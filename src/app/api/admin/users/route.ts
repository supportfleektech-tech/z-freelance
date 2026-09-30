import type { NextRequest } from "next/server";
import { ok, parseQuery, route, throttle } from "@/lib/api/http";
import { adminUserQuerySchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { listUsers } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — moderation directory. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "admin:users");

  await requireRole("ADMIN");
  const query = parseQuery(request, adminUserQuerySchema);

  return ok(await listUsers(query));
});

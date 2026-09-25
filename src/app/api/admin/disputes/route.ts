import type { NextRequest } from "next/server";
import { ok, parseQuery, route, throttle } from "@/lib/api/http";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { listDisputes } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    status: z
      .enum(["OPEN", "IN_REVIEW", "RESOLVED_CLIENT", "RESOLVED_FREELANCER", "WITHDRAWN"])
      .optional(),
  })
  .strict();

/** GET /api/admin/disputes — the moderation queue. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "admin:disputes");

  await requireRole("ADMIN");
  const query = parseQuery(request, querySchema);

  return ok({ disputes: await listDisputes({ status: query.status }) });
});

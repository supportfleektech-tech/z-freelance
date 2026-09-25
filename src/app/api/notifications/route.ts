import type { NextRequest } from "next/server";
import { ok, parseQuery, route, throttle } from "@/lib/api/http";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { listNotifications } from "@/server/services/notification.service";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    unreadOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  })
  .strict();

/** GET /api/notifications — paginated feed with an unread counter. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "notifications:list");

  const user = await requireUser();
  const query = parseQuery(request, querySchema);
  const database = await getDb();

  return ok(await listNotifications(database, user.id, query));
});

import type { NextRequest } from "next/server";
import { ok, parseBody, route, throttle } from "@/lib/api/http";
import { markNotificationsReadSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { markNotificationsRead } from "@/server/services/notification.service";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST /api/notifications/read — mark specific notifications, or all, as read. */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "notifications:read");

  const user = await requireUser();
  const input = await parseBody(request, markNotificationsReadSchema);
  const database = await getDb();

  return ok({ updated: await markNotificationsRead(database, user.id, input) });
});

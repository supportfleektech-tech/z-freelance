import type { NextRequest } from "next/server";
import { ok, parseBody, route, throttle } from "@/lib/api/http";
import { notificationPrefsSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/server/services/notification.service";

export const dynamic = "force-dynamic";

/** GET /api/me/notification-prefs — the caller's per-type switches. */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ prefs: await getNotificationPrefs(user.id) });
});

/** PATCH /api/me/notification-prefs — merge explicit on/off choices. */
export const PATCH = route(async (request: NextRequest) => {
  throttle(request, "api", "notification-prefs:update");

  const user = await requireUser();
  const patch = await parseBody(request, notificationPrefsSchema);
  return ok({ prefs: await updateNotificationPrefs(user.id, patch) });
});

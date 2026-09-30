import { ok, route, ApiError } from "@/lib/api/http";
import { getCurrentUser } from "@/lib/auth/guards";
import { db as getDb } from "@/lib/db";
import { getProfileBundle } from "@/server/services/account.service";
import { getWallet } from "@/server/services/contract.service";
import { listNotifications } from "@/server/services/notification.service";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — the signed-in user, their profile and unread count. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthorized();

  const database = await getDb();
  const [bundle, notifications] = await Promise.all([
    getProfileBundle(user.id),
    listNotifications(database, user.id, { pageSize: 5 }),
  ]);

  const wallet = user.role === "FREELANCER" ? await getWallet(user.id).catch(() => null) : null;

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    freelancer: bundle?.freelancer ?? null,
    client: bundle?.client ?? null,
    wallet,
    unreadNotifications: notifications.unread,
  });
});

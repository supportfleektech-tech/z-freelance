import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notifications, users, type NotificationType } from "@/lib/db/schema";
import { db as getDb, type DbOrTx } from "@/lib/db";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** A missing key means "enabled" — users opt out, never in. */
function typeEnabled(prefs: Record<string, boolean> | null, type: NotificationType): boolean {
  return prefs?.[type] !== false;
}

/**
 * Drop notifications the recipient has switched off in their preferences.
 * One batched read regardless of how many recipients are involved.
 */
async function filterByPrefs(tx: DbOrTx, inputs: NotifyInput[]): Promise<NotifyInput[]> {
  if (inputs.length === 0) return [];
  const userIds = [...new Set(inputs.map((i) => i.userId))];
  const rows = await tx
    .select({ id: users.id, prefs: users.notificationPrefs })
    .from(users)
    .where(inArray(users.id, userIds));
  const prefsById = new Map(rows.map((r) => [r.id, r.prefs]));
  return inputs.filter((i) => typeEnabled(prefsById.get(i.userId) ?? null, i.type));
}

/** Create one in-app notification. Called inside the same transaction as the action that caused it. */
export async function notify(tx: DbOrTx, input: NotifyInput): Promise<void> {
  await notifyMany(tx, [input]);
}

export async function notifyMany(tx: DbOrTx, inputs: NotifyInput[]): Promise<void> {
  const deliverable = await filterByPrefs(tx, inputs);
  if (deliverable.length === 0) return;
  await tx.insert(notifications).values(
    deliverable.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null,
    })),
  );
}

/** The caller's full preference map (absent types = enabled). */
export async function getNotificationPrefs(userId: string): Promise<Record<string, boolean>> {
  const database = await getDb();
  const [row] = await database
    .select({ prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.prefs ?? {};
}

/** Merge explicit per-type choices into the stored preferences. */
export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<Record<NotificationType, boolean>>,
): Promise<Record<string, boolean>> {
  const database = await getDb();
  const current = await getNotificationPrefs(userId);
  const merged: Record<string, boolean> = { ...current };
  for (const [type, enabled] of Object.entries(patch)) {
    if (enabled === true) {
      // Enabled is the default — no need to store anything.
      delete merged[type];
    } else {
      merged[type] = false;
    }
  }
  await database
    .update(users)
    .set({ notificationPrefs: merged, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return merged;
}

export interface ListNotificationsOptions {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export async function listNotifications(
  db: DbOrTx,
  userId: string,
  options: ListNotificationsOptions = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const conditions = [eq(notifications.userId, userId)];
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));

  const [items, totalRow, unreadRow] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return {
    items,
    page,
    pageSize,
    total: totalRow[0]?.value ?? 0,
    unread: unreadRow[0]?.value ?? 0,
  };
}

export async function markNotificationsRead(
  db: DbOrTx,
  userId: string,
  options: { ids?: string[]; all?: boolean },
): Promise<number> {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (!options.all && options.ids?.length) conditions.push(inArray(notifications.id, options.ids));

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions))
    .returning({ id: notifications.id });
  return updated.length;
}

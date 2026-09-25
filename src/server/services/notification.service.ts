import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notifications, type NotificationType } from "@/lib/db/schema";
import type { DbOrTx } from "@/lib/db";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Create one in-app notification. Called inside the same transaction as the action that caused it. */
export async function notify(tx: DbOrTx, input: NotifyInput): Promise<void> {
  await tx.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
}

export async function notifyMany(tx: DbOrTx, inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await tx.insert(notifications).values(
    inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null,
    })),
  );
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

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db as getDb, type Tx } from "@/lib/db";
import { contracts, messages, proposals, projects, threads, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { notify } from "./notification.service";

export interface ThreadSummary {
  id: string;
  subject: string;
  lastMessageAt: Date;
  participantId: string;
  participantName: string;
  contractId: string | null;
  projectId: string | null;
  preview: string | null;
  unread: number;
}

/**
 * Find (or create) the conversation between two users about the same
 * proposal/contract/project. Re-using an existing thread keeps history in one
 * place instead of forking a new thread every time someone clicks "message".
 */
export async function getOrCreateThread(
  tx: Tx,
  input: {
    participantAId: string;
    participantBId: string;
    subject: string;
    contractId?: string | null;
    proposalId?: string | null;
    projectId?: string | null;
  },
): Promise<{ id: string }> {
  const anchor = or(
    input.contractId ? eq(threads.contractId, input.contractId) : undefined,
    input.proposalId ? eq(threads.proposalId, input.proposalId) : undefined,
    input.projectId ? eq(threads.projectId, input.projectId) : undefined,
  );

  if (anchor) {
    const [existing] = await tx
      .select({ id: threads.id })
      .from(threads)
      .where(
        and(
          anchor,
          or(
            and(
              eq(threads.participantAId, input.participantAId),
              eq(threads.participantBId, input.participantBId),
            ),
            and(
              eq(threads.participantAId, input.participantBId),
              eq(threads.participantBId, input.participantAId),
            ),
          ),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await tx
    .insert(threads)
    .values({
      participantAId: input.participantAId,
      participantBId: input.participantBId,
      subject: input.subject,
      contractId: input.contractId ?? null,
      proposalId: input.proposalId ?? null,
      projectId: input.projectId ?? null,
    })
    .returning({ id: threads.id });

  if (!created) throw new Error("thread insert returned no row");
  return created;
}

/** Append a message and notify the other participant. */
export async function sendMessage(
  tx: Tx,
  input: { threadId: string; senderId: string; body: string },
): Promise<{ id: string }> {
  const [thread] = await tx.select().from(threads).where(eq(threads.id, input.threadId)).limit(1);
  if (!thread) throw ApiError.notFound("Conversation not found.");

  const isParticipant =
    thread.participantAId === input.senderId || thread.participantBId === input.senderId;
  if (!isParticipant) throw ApiError.forbidden("You are not part of this conversation.");

  const [message] = await tx
    .insert(messages)
    .values({ threadId: thread.id, senderId: input.senderId, body: input.body })
    .returning({ id: messages.id });
  if (!message) throw new Error("message insert returned no row");

  await tx.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, thread.id));

  const recipientId =
    thread.participantAId === input.senderId ? thread.participantBId : thread.participantAId;

  await notify(tx, {
    userId: recipientId,
    type: "MESSAGE_RECEIVED",
    title: `New message · ${thread.subject}`,
    body: input.body.length > 140 ? `${input.body.slice(0, 139)}…` : input.body,
    link: `/dashboard/messages?thread=${thread.id}`,
  });

  return message;
}

/** The caller's inbox: one row per thread, newest activity first. */
export async function listThreads(userId: string): Promise<ThreadSummary[]> {
  const database = await getDb();

  const rows = await database
    .select({
      id: threads.id,
      subject: threads.subject,
      lastMessageAt: threads.lastMessageAt,
      participantAId: threads.participantAId,
      participantBId: threads.participantBId,
      contractId: threads.contractId,
      projectId: threads.projectId,
    })
    .from(threads)
    .where(or(eq(threads.participantAId, userId), eq(threads.participantBId, userId)))
    .orderBy(desc(threads.lastMessageAt));

  if (rows.length === 0) return [];

  const otherIds = rows.map((r) =>
    r.participantAId === userId ? r.participantBId : r.participantAId,
  );
  const people = await database
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, otherIds));
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  const previews = await database
    .select({
      threadId: messages.threadId,
      body: messages.body,
      createdAt: messages.createdAt,
      rn: sql<number>`row_number() over (partition by ${messages.threadId} order by ${messages.createdAt} desc)`,
    })
    .from(messages)
    .where(
      inArray(
        messages.threadId,
        rows.map((r) => r.id),
      ),
    );

  const previewByThread = new Map(
    previews.filter((p) => p.rn === 1).map((p) => [p.threadId, p.body]),
  );

  const unreadRows = await database
    .select({
      threadId: messages.threadId,
      value: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(
      and(
        inArray(
          messages.threadId,
          rows.map((r) => r.id),
        ),
        isNull(messages.readAt),
        sql`${messages.senderId} <> ${userId}`,
      ),
    )
    .groupBy(messages.threadId);
  const unreadByThread = new Map(unreadRows.map((u) => [u.threadId, u.value]));

  return rows.map((row) => {
    const otherId = row.participantAId === userId ? row.participantBId : row.participantAId;
    return {
      id: row.id,
      subject: row.subject,
      lastMessageAt: row.lastMessageAt,
      participantId: otherId,
      participantName: nameById.get(otherId) ?? "Unknown user",
      contractId: row.contractId,
      projectId: row.projectId,
      preview: previewByThread.get(row.id) ?? null,
      unread: unreadByThread.get(row.id) ?? 0,
    };
  });
}

/** Full message history for one thread, oldest first. Marks the caller's copies read. */
export async function getThread(userId: string, threadId: string) {
  const database = await getDb();

  const [thread] = await database.select().from(threads).where(eq(threads.id, threadId)).limit(1);
  if (!thread) throw ApiError.notFound("Conversation not found.");
  if (thread.participantAId !== userId && thread.participantBId !== userId) {
    throw ApiError.forbidden("You are not part of this conversation.");
  }

  const rows = await database
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.createdAt);

  await database
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.threadId, threadId),
        isNull(messages.readAt),
        sql`${messages.senderId} <> ${userId}`,
      ),
    );

  const otherId = thread.participantAId === userId ? thread.participantBId : thread.participantAId;
  const [other] = await database
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, otherId))
    .limit(1);

  return {
    thread: { ...thread, participantName: other?.name ?? "Unknown user" },
    messages: rows,
  };
}

/** Contextual subject line for a new conversation started from a marketplace page. */
export interface ThreadAnchor {
  /** Both sides of the conversation; the other party is picked by the caller. */
  partyAId: string;
  /** null means an OPEN anchor (project) — any signed-in user except the owner may start. */
  partyBId: string | null;
  subject: string;
  contractId: string | null;
  proposalId: string | null;
  projectId: string | null;
}

export async function resolveThreadAnchor(input: {
  proposalId?: string;
  contractId?: string;
  projectId?: string;
}): Promise<ThreadAnchor | null> {
  const database = await getDb();

  if (input.proposalId) {
    const [proposal] = await database
      .select({
        id: proposals.id,
        freelancerId: proposals.freelancerId,
        projectId: proposals.projectId,
        title: projects.title,
        clientId: projects.clientId,
      })
      .from(proposals)
      .innerJoin(projects, eq(projects.id, proposals.projectId))
      .where(eq(proposals.id, input.proposalId))
      .limit(1);
    if (!proposal) return null;
    return {
      partyAId: proposal.clientId,
      partyBId: proposal.freelancerId,
      subject: `About your proposal · ${proposal.title}`,
      contractId: null,
      proposalId: proposal.id,
      projectId: proposal.projectId,
    };
  }

  if (input.contractId) {
    const [contract] = await database
      .select()
      .from(contracts)
      .where(eq(contracts.id, input.contractId))
      .limit(1);
    if (!contract) return null;
    return {
      partyAId: contract.clientId,
      partyBId: contract.freelancerId,
      subject: `Contract · ${contract.title}`,
      contractId: contract.id,
      proposalId: null,
      projectId: contract.projectId,
    };
  }

  if (input.projectId) {
    const [project] = await database
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);
    if (!project) return null;
    return {
      partyAId: project.clientId,
      partyBId: null,
      subject: `Question about · ${project.title}`,
      contractId: null,
      proposalId: null,
      projectId: project.id,
    };
  }

  return null;
}

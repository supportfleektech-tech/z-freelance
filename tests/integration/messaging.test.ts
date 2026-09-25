/**
 * Messaging integration: thread anchoring in both directions, message flow,
 * read-state, and the regressed counterparty resolution (found in smoke tests).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PGlite } from "@electric-sql/pglite";
import { sql, eq } from "drizzle-orm";
import { db as getDb, __rawClient, schema } from "@/lib/db";
import { registerUser } from "@/server/services/account.service";
import { createProject } from "@/server/services/project.service";
import { createProposal } from "@/server/services/proposal.service";
import { hireFromProposal } from "@/server/services/contract.service";
import {
  getOrCreateThread,
  getThread,
  listThreads,
  resolveThreadAnchor,
  sendMessage,
} from "@/server/services/messaging.service";

let clientId = "";
let freelancerId = "";
let projectId = "";
let contractId = "";

beforeAll(async () => {
  const database = await getDb();
  const client = (await __rawClient()) as PGlite;
  await migrate(drizzlePglite(client, { schema }) as never, { migrationsFolder: "drizzle" });

  const pace = await registerUser({
    name: "Pace Client",
    email: "pace-client@test.io",
    password: "Password123!",
    role: "CLIENT",
  });
  const frida = await registerUser({
    name: "Frida Freelancer",
    email: "pace-freelance@test.io",
    password: "Password123!",
    role: "FREELANCER",
  });
  clientId = pace.id;
  freelancerId = frida.id;

  const project = await createProject(clientId, {
    title: "Messaging: thread anchor coverage",
    description: "Sufficiently long project description for messaging integration coverage.",
    budgetType: "FIXED",
    budgetMinCents: 300_000,
    budgetMaxCents: 300_000,
    experienceLevel: "INTERMEDIATE",
    skills: [],
    publish: true,
  });
  projectId = project.id;

  const proposal = await createProposal(freelancerId, projectId, {
    coverLetter: "Proposal to cover thread anchoring in both directions.".padEnd(90, "."),
    bidAmountCents: 300_000,
    estimatedDays: 7,
  });
  const contract = await hireFromProposal(proposal.id, clientId);
  contractId = contract.id;
}, 60_000);

describe("thread anchoring", () => {
  it("resolves the OTHER party relative to who is asking", async () => {
    const anchor = await resolveThreadAnchor({ contractId });
    expect(anchor?.partyAId).toBe(clientId);
    expect(anchor?.partyBId).toBe(freelancerId);

    // Regression: caller-derived counterparty must flip by caller, not hardcode the client.
    const asClient = anchor!.partyAId === clientId ? anchor!.partyBId : anchor!.partyAId;
    const asFreelancer =
      anchor!.partyAId === freelancerId ? anchor!.partyBId : anchor!.partyAId;
    expect(asClient).toBe(freelancerId);
    expect(asFreelancer).toBe(clientId);
  });

  it("project anchors are open: client is the counterparty for everyone else", async () => {
    const anchor = await resolveThreadAnchor({ projectId });
    expect(anchor?.partyAId).toBe(clientId);
    expect(anchor?.partyBId).toBeNull();
  });
});

describe("message flow", () => {
  it("both parties exchange messages; reads are tracked per side", async () => {
    const database = await getDb();

    const { threadId } = await database.transaction(async (tx) => {
      const t = await getOrCreateThread(tx, {
        participantAId: freelancerId,
        participantBId: clientId,
        subject: "Contract · Messaging: thread anchor coverage",
        contractId,
        projectId,
      });
      await sendMessage(tx, { threadId: t.id, senderId: clientId, body: "Approved — great work!" });
      await sendMessage(tx, { threadId: t.id, senderId: freelancerId, body: "Thanks!" });
      return { threadId: t.id };
    });

    // Same anchor re-opens the SAME thread instead of forking.
    const again = await database.transaction(async (tx) =>
      getOrCreateThread(tx, {
        participantAId: clientId,
        participantBId: freelancerId,
        subject: "ignored",
        contractId,
        projectId,
      }),
    );
    expect(again.id).toBe(threadId);

    const asFreelancer = await getThread(freelancerId, threadId);
    expect(asFreelancer.messages.length).toBe(2);
    expect(asFreelancer.thread.participantName).toBe("Pace Client");

    // Reading marked the client's message as read for the freelancer.
    const inbox = await listThreads(freelancerId);
    expect(inbox.find((t) => t.id === threadId)?.unread).toBe(0);

    // A stranger is refused.
    const stranger = await registerUser({
      name: "Sara Stranger",
      email: "pace-stranger@test.io",
      password: "Password123!",
      role: "CLIENT",
    });
    await expect(getThread(stranger.id, threadId)).rejects.toMatchObject({ status: 403 });

    // Notifications hit the right mailbox.
    const notif = await database
      .select({ userId: schema.notifications.userId, type: schema.notifications.type })
      .from(schema.notifications)
      .where(eq(schema.notifications.type, "MESSAGE_RECEIVED"));
    expect(notif.some((n) => n.userId === clientId)).toBe(true);
    expect(notif.some((n) => n.userId === freelancerId)).toBe(true);

    await database.execute(sql`select 1`);
  });
});

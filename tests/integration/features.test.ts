/**
 * Integration suite: the feature pack built on top of the escrow core.
 *
 * Covers portfolio CRUD + authorization, saved-project bookmarks,
 * notification preference gating, review responses, and the file pipeline
 * (store → link → authorize download) for messages and escrow milestones.
 *
 * Runs against the same real embedded Postgres the other suites use; uploads
 * land in the per-process temp dir provisioned by tests/setup.ts.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { desc, eq } from "drizzle-orm";
import { db as getDb, __rawClient, schema } from "@/lib/db";
import type { PGlite } from "@electric-sql/pglite";
import { ApiError } from "@/lib/api/http";
import { config } from "@/lib/config";
import {
  authenticate,
  changePassword,
  registerUser,
  setUserStatus,
} from "@/server/services/account.service";
import { createSessionToken, isSessionFresh, verifySessionToken } from "@/lib/auth/session";
import { createProject } from "@/server/services/project.service";
import { createProposal } from "@/server/services/proposal.service";
import {
  fundMilestone,
  hireFromProposal,
  setMilestonePlan,
  submitWork,
  approveMilestone,
} from "@/server/services/contract.service";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItems,
  updatePortfolioItem,
} from "@/server/services/portfolio.service";
import {
  isProjectSaved,
  listSavedProjects,
  setProjectSaved,
} from "@/server/services/saved-projects.service";
import {
  getNotificationPrefs,
  listNotifications,
  updateNotificationPrefs,
} from "@/server/services/notification.service";
import {
  createReview,
  deleteReviewResponse,
  listReviewsForUser,
  respondToReview,
} from "@/server/services/review.service";
import {
  assertCanView,
  deleteUpload,
  gcOrphanedUploads,
  storeUpload,
} from "@/server/services/storage.service";
import { getOrCreateThread, getThread, sendMessage } from "@/server/services/messaging.service";

const people: Record<string, { id: string; role: string }> = {};
const state: {
  projectId?: string;
  project2Id?: string;
  threadId?: string;
  contractId?: string;
  milestoneId?: string;
  reviewToSofia?: string;
  reviewToClient?: string;
  messageAttachmentId?: string;
  milestoneAttachmentId?: string;
} = {};

async function expectStatus(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`expected ApiError ${status}, but the call succeeded`);
}

beforeAll(async () => {
  await getDb();
  const client = (await __rawClient()) as PGlite;
  await migrate(drizzlePglite(client, { schema }) as never, { migrationsFolder: "drizzle" });

  for (const [key, email, role] of [
    ["client", "feat-client@test.io", "CLIENT"],
    ["sofia", "feat-sofia@test.io", "FREELANCER"],
    ["stranger", "feat-stranger@test.io", "FREELANCER"],
    ["client2", "feat-client2@test.io", "CLIENT"],
  ] as const) {
    const user = await registerUser({
      name: `Feat ${key}`,
      email,
      password: "Password123!",
      role,
    });
    people[key] = { id: user.id, role: user.role };
  }
  const admin = await registerUser({
    name: "Feat Admin",
    email: "feat-admin@test.io",
    password: "Password123!",
    role: "CLIENT",
  });
  const database = await getDb();
  await database.update(schema.users).set({ role: "ADMIN" }).where(eq(schema.users.id, admin.id));
  people.admin = { id: admin.id, role: "ADMIN" };

  // An OPEN project per client — one drives messaging, the other bookmarks.
  for (const key of ["client", "client2"] as const) {
    const project = await createProject(people[key]!.id, {
      title: `Features suite project · ${key}`,
      description:
        "A project with enough description length to be valid for the marketplace rules.",
      budgetType: "FIXED",
      budgetMinCents: 200_000,
      budgetMaxCents: 200_000,
      experienceLevel: "INTERMEDIATE",
      skills: [],
      publish: true,
    });
    state[key === "client" ? "projectId" : "project2Id"] = project.id;
  }

  // A conversation between the main client and sofia (open-project anchor).
  const thread = await database.transaction(async (tx) =>
    getOrCreateThread(tx, {
      participantAId: people.client!.id,
      participantBId: people.sofia!.id,
      subject: "Features suite thread",
      projectId: state.projectId!,
    }),
  );
  state.threadId = thread.id;
}, 60_000);

/* ---------------------------------------------------------------- uploads */

describe("uploads & attachments", () => {
  it("stores a text file on disk with metadata", async () => {
    const attachment = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MESSAGE",
      fileName: "delivery notes.txt",
      mimeType: "text/plain",
      data: Buffer.from("hello from the attachment pipeline"),
    });
    expect(attachment.fileName).toBe("delivery notes.txt");
    expect(await readdir(path.resolve(config.uploadDir))).toContain(attachment.storageKey);
  });

  it("rejects a disallowed MIME type and empty files", async () => {
    await expectStatus(
      storeUpload({
        uploaderId: people.sofia!.id,
        context: "MESSAGE",
        fileName: "run.exe",
        mimeType: "application/x-msdownload",
        data: Buffer.from("MZ"),
      }),
      422,
    );
    await expectStatus(
      storeUpload({
        uploaderId: people.sofia!.id,
        context: "MESSAGE",
        fileName: "empty.txt",
        mimeType: "text/plain",
        data: Buffer.alloc(0),
      }),
      422,
    );
  });

  it("links an attachment to a message inside the send transaction", async () => {
    const attachment = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MESSAGE",
      fileName: "wireframe.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF-1.4 fake"),
    });
    state.messageAttachmentId = attachment.id;

    const database = await getDb();
    await database.transaction(async (tx) =>
      sendMessage(tx, {
        threadId: state.threadId!,
        senderId: people.sofia!.id,
        body: "Sending the wireframe over.",
        attachmentIds: [attachment.id],
      }),
    );

    const thread = await getThread(people.sofia!.id, state.threadId!);
    const withFile = thread.messages.find((m) => m.attachments.length > 0);
    expect(withFile?.attachments[0]?.fileName).toBe("wireframe.pdf");
    expect(withFile?.attachments[0]?.sizeBytes).toBeGreaterThan(0);
  });

  it("cannot attach someone else's file, and cannot re-link a used file", async () => {
    const stolen = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MESSAGE",
      fileName: "secret.txt",
      mimeType: "text/plain",
      data: Buffer.from("nope"),
    });
    const database = await getDb();
    await expectStatus(
      database.transaction(async (tx) =>
        sendMessage(tx, {
          threadId: state.threadId!,
          senderId: people.client!.id,
          body: "Trying to attach sofia's file",
          attachmentIds: [stolen.id],
        }),
      ),
      403,
    );

    await expectStatus(
      database.transaction(async (tx) =>
        sendMessage(tx, {
          threadId: state.threadId!,
          senderId: people.sofia!.id,
          body: "Trying to re-attach the wireframe",
          attachmentIds: [state.messageAttachmentId!],
        }),
      ),
      409,
    );
  });

  it("authorizes download by conversation, with a deny for strangers", async () => {
    const database = await getDb();
    const id = state.messageAttachmentId!;
    await assertCanView(database, people.sofia!, id);
    await assertCanView(database, people.client!, id);
    await assertCanView(database, people.admin!, id);
    await expectStatus(assertCanView(database, people.stranger!, id), 403);
    await expectStatus(assertCanView(database, null, id), 401);

    // The uploader can delete an UNLINKED upload, but not linked history.
    const stray = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MESSAGE",
      fileName: "scratch.txt",
      mimeType: "text/plain",
      data: Buffer.from("x"),
    });
    await deleteUpload(people.sofia!.id, stray.id);
    await expectStatus(deleteUpload(people.sofia!.id, id), 409);
  });

  it("serves portfolio imagery to the anonymous public", async () => {
    const image = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "PORTFOLIO",
      fileName: "cover.png",
      mimeType: "image/png",
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
    });
    const database = await getDb();
    await assertCanView(database, null, image.id);
    await deleteUpload(people.sofia!.id, image.id);
  });

  it("rejects files uploaded for the wrong context", async () => {
    const wrongContext = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MILESTONE",
      fileName: "build.zip",
      mimeType: "application/zip",
      data: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
    });
    const database = await getDb();
    await expectStatus(
      database.transaction(async (tx) =>
        sendMessage(tx, {
          threadId: state.threadId!,
          senderId: people.sofia!.id,
          body: "Wrong context test",
          attachmentIds: [wrongContext.id],
        }),
      ),
      422,
    );
  });
});

/* --------------------------------------------------------------- portfolio */

describe("portfolio", () => {
  it("creates, lists, updates and deletes items for a freelancer", async () => {
    const created = await createPortfolioItem(people.sofia!.id, {
      title: "Realtime billing dashboard",
      description: "Usage charts for a metered SaaS.",
      url: "https://example.com/work/billing",
    });
    expect(created.position).toBe(0);

    const renamed = await updatePortfolioItem(people.sofia!.id, created.id, {
      title: "Realtime billing dashboard v2",
    });
    expect(renamed.title).toContain("v2");

    const list = await listPortfolioItems(people.sofia!.id);
    expect(list).toHaveLength(1);

    await deletePortfolioItem(people.sofia!.id, created.id);
    expect(await listPortfolioItems(people.sofia!.id)).toHaveLength(0);
  });

  it("refuses clients creating portfolio items and strangers editing them", async () => {
    await expectStatus(createPortfolioItem(people.client!.id, { title: "Not my place" }), 403);

    const owned = await createPortfolioItem(people.sofia!.id, { title: "Owned piece" });
    await expectStatus(
      updatePortfolioItem(people.stranger!.id, owned.id, { title: "Hijacked" }),
      404,
    );
    await expectStatus(deletePortfolioItem(people.stranger!.id, owned.id), 404);
    await deletePortfolioItem(people.sofia!.id, owned.id);
  });
});

/* ------------------------------------------------------------ saved projects */

describe("saved projects", () => {
  it("saves, dedupes, lists and unsaves bookmarks", async () => {
    expect(await isProjectSaved(people.sofia!.id, state.project2Id!)).toBe(false);

    await setProjectSaved(people.sofia!.id, state.project2Id!, true);
    await setProjectSaved(people.sofia!.id, state.project2Id!, true); // idempotent
    expect(await isProjectSaved(people.sofia!.id, state.project2Id!)).toBe(true);

    const list = await listSavedProjects(people.sofia!.id);
    const mine = list.filter((i) => i.projectId === state.project2Id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.title).toContain("client2");

    await setProjectSaved(people.sofia!.id, state.project2Id!, false);
    expect(await isProjectSaved(people.sofia!.id, state.project2Id!)).toBe(false);
  });

  it("refuses saving your own project (and is private to the saver)", async () => {
    await expectStatus(setProjectSaved(people.client!.id, state.projectId!, true), 403);

    await setProjectSaved(people.sofia!.id, state.project2Id!, true);
    expect(await listSavedProjects(people.stranger!.id)).toHaveLength(0);
    await setProjectSaved(people.sofia!.id, state.project2Id!, false);
  });
});

/* ------------------------------------------------------- notification prefs */

describe("notification preferences", () => {
  it("suppresses disabled types and re-enables them", async () => {
    const database = await getDb();
    const before = await listNotifications(database, people.client!.id, { pageSize: 50 });

    await updateNotificationPrefs(people.client!.id, { MESSAGE_RECEIVED: false });
    expect((await getNotificationPrefs(people.client!.id)).MESSAGE_RECEIVED).toBe(false);

    await database.transaction(async (tx) =>
      sendMessage(tx, {
        threadId: state.threadId!,
        senderId: people.sofia!.id,
        body: "This one should be silenced.",
      }),
    );
    const during = await listNotifications(database, people.client!.id, { pageSize: 50 });
    expect(during.total).toBe(before.total);

    await updateNotificationPrefs(people.client!.id, { MESSAGE_RECEIVED: true });
    expect((await getNotificationPrefs(people.client!.id)).MESSAGE_RECEIVED).toBeUndefined();

    await database.transaction(async (tx) =>
      sendMessage(tx, {
        threadId: state.threadId!,
        senderId: people.sofia!.id,
        body: "And this one comes through again.",
      }),
    );
    const after = await listNotifications(database, people.client!.id, { pageSize: 50 });
    expect(after.total).toBe(before.total + 1);
    expect(after.items[0]?.type).toBe("MESSAGE_RECEIVED");
  });
});

/* ------------------------------------------------ reviews & escrow files */

describe("milestone deliverables + review responses", () => {
  it("runs a contract to completion with an attached deliverable", async () => {
    const database = await getDb();

    const proposal = await createProposal(people.sofia!.id, state.projectId!, {
      coverLetter:
        "I will deliver exactly one milestone of features-suite work, with a file attached to prove the pipeline.",
      bidAmountCents: 100_000,
      estimatedDays: 7,
    });
    const contract = await hireFromProposal(proposal.id, people.client!.id);
    state.contractId = contract.id;

    const [milestone] = await setMilestonePlan(contract.id, people.client!.id, [
      { title: "The only milestone", amountCents: 100_000 },
    ]);
    state.milestoneId = milestone!.id;

    await fundMilestone(milestone!.id, people.client!.id);

    const deliverable = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MILESTONE",
      fileName: "final-report.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF-1.4 report"),
    });
    state.milestoneAttachmentId = deliverable.id;

    await submitWork(milestone!.id, people.sofia!.id, "Report attached, work done.", [
      deliverable.id,
    ]);

    // The bound file is visible to the contract parties (and admins) only.
    await assertCanView(database, people.sofia!, deliverable.id);
    await assertCanView(database, people.client!, deliverable.id);
    await assertCanView(database, people.admin!, deliverable.id);
    await expectStatus(assertCanView(database, people.stranger!, deliverable.id), 403);

    await approveMilestone(milestone!.id, people.client!.id);

    const [done] = await database
      .select({ status: schema.contracts.status })
      .from(schema.contracts)
      .where(eq(schema.contracts.id, contract.id))
      .limit(1);
    expect(done?.status).toBe("COMPLETED");
  });

  it("lets each party review, then the subjects respond — once", async () => {
    const clientToSofia = await createReview(people.client!.id, {
      contractId: state.contractId!,
      rating: 5,
      comment: "Great deliverable, file attached as promised.",
    });
    state.reviewToSofia = clientToSofia.id;

    const sofiaToClient = await createReview(people.sofia!.id, {
      contractId: state.contractId!,
      rating: 4,
      comment: "Solid brief, quick approvals.",
    });
    state.reviewToClient = sofiaToClient.id;

    const database = await getDb();

    // The author's reply attempt on their OWN review is rejected.
    await expectStatus(
      respondToReview(people.client!.id, state.reviewToSofia, "Wait, I'm the author!"),
      403,
    );

    // The subject responds once; the author is notified.
    const prefsBefore = await listNotifications(database, people.client!.id, { pageSize: 5 });
    await respondToReview(people.sofia!.id, state.reviewToSofia, "Thanks — a pleasure.");
    const latest = await database
      .select({ type: schema.notifications.type, userId: schema.notifications.userId })
      .from(schema.notifications)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(1);
    expect(latest[0]?.userId).toBe(people.client!.id);
    expect(latest[0]?.type).toBe("REVIEW_RECEIVED");
    expect((await listNotifications(database, people.client!.id, { pageSize: 5 })).total).toBe(
      prefsBefore.total + 1,
    );

    // …but only once.
    await expectStatus(
      respondToReview(people.sofia!.id, state.reviewToSofia, "Changing my answer"),
      409,
    );

    // The stored response renders through the listing the dashboard consumes.
    const received = await listReviewsForUser(people.sofia!.id);
    expect(received.find((r) => r.id === state.reviewToSofia)?.responseText).toContain("pleasure");

    // Retraction clears it.
    await deleteReviewResponse(people.sofia!.id, state.reviewToSofia);
    const cleared = await listReviewsForUser(people.sofia!.id);
    expect(cleared.find((r) => r.id === state.reviewToSofia)?.responseAt).toBeNull();
  });

  it("honours opt-outs for review-response notifications", async () => {
    const database = await getDb();
    await updateNotificationPrefs(people.client!.id, { REVIEW_RECEIVED: false });

    // Respond as the client (subject) on sofia's review — sofia has defaults.
    await respondToReview(people.client!.id, state.reviewToClient!, "Appreciated.");
    const sofiaInbox = await database
      .select({ type: schema.notifications.type })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, people.sofia!.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(1);
    expect(sofiaInbox[0]?.type).toBe("REVIEW_RECEIVED");

    // KEY assertion: after the opt-out, nothing new reached the client. The
    // client has exactly the two pre-opt-out REVIEW_RECEIVED rows — one from
    // sofia's createReview above, one from her (since-retracted) response.
    const reviewNotices = await database
      .select({ type: schema.notifications.type })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, people.client!.id));
    expect(reviewNotices.filter((n) => n.type === "REVIEW_RECEIVED")).toHaveLength(2);

    await updateNotificationPrefs(people.client!.id, { REVIEW_RECEIVED: true });
  });
});

/* ----------------------------------------------------- session revocation */

/** Sign a session token with a chosen iat — models a session opened earlier. */
async function signSessionAt(userId: string, role: "CLIENT" | "FREELANCER" | "ADMIN", iat: number) {
  const { SignJWT } = await import("jose");
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60 * 60 * 24 * 7)
    .setIssuer("z-freelance")
    .setAudience("z-freelance-web")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
}

describe("session revocation", () => {
  it("password change kills every pre-change token", async () => {
    const account = await registerUser({
      name: "Revocable Riley",
      email: "feat-revoke@test.io",
      password: "Password123!",
      role: "CLIENT",
    });

    // A session opened ten minutes ago (back-dated — deterministic).
    const oldIat = Math.floor(Date.now() / 1000) - 600;
    const tokenBefore = await signSessionAt(account.id, account.role, oldIat);
    const payloadBefore = await verifySessionToken(tokenBefore);
    expect(payloadBefore).not.toBeNull();

    // Fresh by definition before anything happens.
    const database = await getDb();
    let [row] = await database
      .select({ cut: schema.users.sessionsInvalidatedAt })
      .from(schema.users)
      .where(eq(schema.users.id, account.id))
      .limit(1);
    expect(isSessionFresh(row?.cut ?? null, payloadBefore!.iat)).toBe(true);

    await changePassword(account.id, "Password123!", "BetterPass99!");

    [row] = await database
      .select({ cut: schema.users.sessionsInvalidatedAt })
      .from(schema.users)
      .where(eq(schema.users.id, account.id))
      .limit(1);
    expect(row?.cut).not.toBeNull();
    // The old token (signed before the change) is now stale…
    expect(isSessionFresh(row!.cut, payloadBefore!.iat)).toBe(false);

    // …but the old credentials fail and the USER can still get back in
    // even when they do it inside the same wall-clock second.
    await expectStatus(authenticate("feat-revoke@test.io", "Password123!"), 401);
    const backIn = await authenticate("feat-revoke@test.io", "BetterPass99!");
    const tokenAfter = await createSessionToken(backIn.id, backIn.role);
    const payloadAfter = await verifySessionToken(tokenAfter);
    expect(isSessionFresh(row!.cut, payloadAfter!.iat)).toBe(true);
  });

  it("suspension watermarks sessions and reactivation does not revive them", async () => {
    const target = await registerUser({
      name: "Suspendable Sue",
      email: "feat-suspend@test.io",
      password: "Password123!",
      role: "FREELANCER",
    });
    // Back-date the session so the watermark comparison is deterministic.
    const oldIat = Math.floor(Date.now() / 1000) - 120;
    const token = await signSessionAt(target.id, target.role, oldIat);
    const payload = await verifySessionToken(token);

    await setUserStatus(people.admin!.id, target.id, "SUSPENDED", "review suite");

    const database = await getDb();
    const [row] = await database
      .select({ cut: schema.users.sessionsInvalidatedAt, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, target.id))
      .limit(1);
    expect(row?.status).toBe("SUSPENDED");
    expect(isSessionFresh(row!.cut, payload!.iat)).toBe(false);

    await setUserStatus(people.admin!.id, target.id, "ACTIVE");
    const [reRow] = await database
      .select({ cut: schema.users.sessionsInvalidatedAt })
      .from(schema.users)
      .where(eq(schema.users.id, target.id))
      .limit(1);
    // Never revive a token that crossed a suspension.
    expect(isSessionFresh(reRow!.cut, payload!.iat)).toBe(false);
  });
});

/* ---------------------------------------------------------- upload GC */

describe("upload garbage collection", () => {
  it("sweeps only true orphans, preserving linked and referenced files", async () => {
    const database = await getDb();
    const cutoff = new Date(Date.now() + 60_000); // future — sweeps every unlinked row

    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    // 1. A linked message attachment (from the earlier test) must survive.
    const linkedId = state.messageAttachmentId!;

    // 2. A portfolio image referenced by a saved item must survive.
    const cover = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "PORTFOLIO",
      fileName: "cover.png",
      mimeType: "image/png",
      data: pngBytes,
    });
    await createPortfolioItem(people.sofia!.id, {
      title: "GC-guarded piece",
      imageAttachmentId: cover.id,
    });

    // 3. A genuinely abandoned upload (no links anywhere) is the target.
    const orphan = await storeUpload({
      uploaderId: people.sofia!.id,
      context: "MESSAGE",
      fileName: "abandoned.txt",
      mimeType: "text/plain",
      data: Buffer.from("left behind"),
    });

    const swept = await gcOrphanedUploads(cutoff);
    expect(swept).toBeGreaterThanOrEqual(1);

    const gone = await database
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.id, orphan.id))
      .limit(1);
    expect(gone).toHaveLength(0);
    expect(await readdir(path.resolve(config.uploadDir))).not.toContain(orphan.storageKey);

    const survivors = await database
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.id, linkedId))
      .limit(1);
    expect(survivors).toHaveLength(1);

    const coverKept = await database
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.id, cover.id))
      .limit(1);
    expect(coverKept).toHaveLength(1);
  });
});

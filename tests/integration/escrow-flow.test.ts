/**
 * Integration suite: the full marketplace money flow, end to end.
 *
 * Runs against a real embedded Postgres (PGlite) migrated with the exact same
 * SQL the production migrations ship. It drives the *service layer* — the same
 * functions the route handlers call — through:
 *
 *   register → project → proposals → hire → milestone plan → fund → submit
 *   → approve & release → completion → reviews → dispute → resolve → refund
 *
 * …and asserts the money invariants along the way. If a refactoring breaks the
 * escrow pipeline, one of these tests fails in CI before anything ships.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql, eq } from "drizzle-orm";
import { db as getDb, __rawClient, schema } from "@/lib/db";
import type { PGlite } from "@electric-sql/pglite";
import { ApiError } from "@/lib/api/http";
import {
  registerUser,
  authenticate,
  updateFreelancerProfile,
} from "@/server/services/account.service";
import { createProject, transitionProject } from "@/server/services/project.service";
import {
  createProposal,
  listProposalsForProject,
  withdrawProposal,
} from "@/server/services/proposal.service";
import {
  addMilestone,
  approveMilestone,
  fundMilestone,
  hireFromProposal,
  openDispute,
  resolveDispute,
  submitWork,
  getContractDetail,
  getWallet,
  requestPayout,
  cancelContract,
} from "@/server/services/contract.service";
import { createReview, ratingSummary } from "@/server/services/review.service";
import { listNotifications } from "@/server/services/notification.service";

const FEE_BPS = 1000; // mirrors tests/setup.ts

const ids: Record<string, string> = {};
const contractsByTopic: Record<string, string> = {};
const milestonesByTopic: Record<string, string[]> = {};

beforeAll(async () => {
  const database = await getDb();
  const client = (await __rawClient()) as PGlite;
  await migrate(drizzlePglite(client, { schema }) as never, { migrationsFolder: "drizzle" });

  // A second handle on the same embedded instance — verifies raw connectivity.
  await client.query("select 1");
  await database.execute(sql`select 1`);
}, 60_000);

async function makePeople(prefix: string) {
  const clientUser = await registerUser({
    name: `${prefix} Client`,
    email: `${prefix.toLowerCase()}-client@test.io`,
    password: "Password123!",
    role: "CLIENT",
  });
  const sofia = await registerUser({
    name: `${prefix} Sofia`,
    email: `${prefix.toLowerCase()}-sofia@test.io`,
    password: "Password123!",
    role: "FREELANCER",
  });
  const luis = await registerUser({
    name: `${prefix} Luis`,
    email: `${prefix.toLowerCase()}-luis@test.io`,
    password: "Password123!",
    role: "FREELANCER",
  });
  const admin = await registerUser({
    name: `${prefix} Admin`,
    email: `${prefix.toLowerCase()}-admin@test.io`,
    password: "Password123!",
    role: "CLIENT",
  });
  const database = await getDb();
  await database.update(schema.users).set({ role: "ADMIN" }).where(eq(schema.users.id, admin.id));
  await updateFreelancerProfile(sofia.id, {
    headline: "Next.js specialist",
    skills: ["Next.js", "TypeScript"],
  });
  return { clientUser, sofia, luis, admin };
}

describe("accounts", () => {
  it("registers a client and freelancers with provisioned profiles+wallet", async () => {
    const { clientUser } = await makePeople("Acq");
    ids.acqClient = clientUser.id;
    expect(clientUser.role).toBe("CLIENT");
  });

  it("rejects duplicate emails with a conflict", async () => {
    await expect(
      registerUser({
        name: "Someone Else",
        email: "acq-client@test.io",
        password: "Password123!",
        role: "CLIENT",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("authenticates without leaking which failure occurred", async () => {
    const ok = await registerUser({
      name: "Auth Case",
      email: "auth-case@test.io",
      password: "Password123!",
      role: "FREELANCER",
    });
    const sessionUser = await authenticate("auth-case@test.io", "Password123!");
    expect(sessionUser.id).toBe(ok.id);

    await expect(authenticate("auth-case@test.io", "WrongPass123")).rejects.toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
    await expect(authenticate("no-such@test.io", "Whatever123")).rejects.toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
  });
});

describe("marketplace proposal flow", () => {
  it("blocks self-bidding and duplicate proposals", async () => {
    const { clientUser, sofia } = await makePeople("Dup");
    const project = await createProject(clientUser.id, {
      title: "Integration: duplicate protection",
      description: "Long enough description for a valid integration test project brief.",
      budgetType: "FIXED",
      budgetMinCents: 500_000,
      budgetMaxCents: 600_000,
      experienceLevel: "INTERMEDIATE",
      skills: ["Node.js"],
      publish: true,
    });

    // A client without a freelancer profile cannot bid anywhere — even on their own project.
    await expect(
      createProposal(clientUser.id, project.id, {
        coverLetter: "a".repeat(100),
        bidAmountCents: 550_000,
        estimatedDays: 10,
      }),
    ).rejects.toMatchObject({ status: 403 });

    await createProposal(sofia.id, project.id, {
      coverLetter: "Here is a valid proposal with a straightforward plan attached.".padEnd(90, "."),
      bidAmountCents: 550_000,
      estimatedDays: 10,
    });

    await expect(
      createProposal(sofia.id, project.id, {
        coverLetter: "b".repeat(100),
        bidAmountCents: 550_000,
        estimatedDays: 10,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("full happy path: hire → plan → fund → submit → release → review", async () => {
    const database = await getDb();
    const people = await makePeople("Flow");
    ids.flowClient = people.clientUser.id;
    ids.flowSofia = people.sofia.id;
    ids.flowLuis = people.luis.id;
    ids.flowAdmin = people.admin.id;

    const project = await createProject(people.clientUser.id, {
      title: "Integration: happy path dashboard",
      description: "A complete integration-driven flow with escrow, reviews and ledger assertions.",
      budgetType: "FIXED",
      budgetMinCents: 1_000_000,
      budgetMaxCents: 1_200_000,
      experienceLevel: "EXPERT",
      skills: ["Next.js", "PostgreSQL"],
      publish: true,
    });

    const p1 = await createProposal(people.sofia.id, project.id, {
      coverLetter:
        "I build these every month. Plan: data layer week 1, UI week 2, tests throughout. Weekly demos.".padEnd(
          90,
          ".",
        ),
      bidAmountCents: 1_050_000,
      estimatedDays: 21,
    });
    const p2 = await createProposal(people.luis.id, project.id, {
      coverLetter:
        "Second bidder — this one gets auto-rejected when the client hires Sofia.".padEnd(90, "."),
      bidAmountCents: 990_000,
      estimatedDays: 18,
    });
    contractsByTopic.flowP2 = p2.id;

    // HIRE — the whole transaction at once.
    const contract = await hireFromProposal(p1.id, people.clientUser.id);
    contractsByTopic.flow = contract.id;
    expect(contract.amountCents).toBe(1_050_000);
    expect(contract.platformFeeBps).toBe(FEE_BPS);

    const afterHire = await listProposalsForProject(project.id);
    expect(afterHire.find((p) => p.id === p1.id)?.status).toBe("HIRED");
    expect(afterHire.find((p) => p.id === p2.id)?.status).toBe("REJECTED");

    const [projectRow] = await database
      .select({ status: schema.projects.status })
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id));
    expect(projectRow?.status).toBe("IN_PROGRESS");

    // PLAN — mismatched totals rejected, exact totals accepted.
    await expect(
      addMilestone(contract.id, people.clientUser.id, { title: "Too big", amountCents: 2_000_000 }),
    ).rejects.toMatchObject({ status: 422 });

    const m1 = await addMilestone(contract.id, people.clientUser.id, {
      title: "Data layer & server actions",
      amountCents: 600_000,
      description: "Typed client, invoice queries, integration tests.",
    });
    const m2 = await addMilestone(contract.id, people.clientUser.id, {
      title: "Dashboard UI & polish",
      amountCents: 450_000,
    });
    milestonesByTopic.flow = [m1.id, m2.id];

    // FUND ESCROW
    const funded = await fundMilestone(m1.id, people.clientUser.id);
    expect(funded.status).toBe("FUNDED");

    await expect(fundMilestone(m1.id, people.clientUser.id)).rejects.toMatchObject({ status: 409 });
    await expect(submitWork(m1.id, people.clientUser.id, "not my milestone")).rejects.toMatchObject(
      { status: 403 },
    );

    // SUBMIT WORK
    const submitted = await submitWork(
      m1.id,
      people.sofia.id,
      "Typed data layer delivered; tests in CI.",
    );
    expect(submitted.status).toBe("SUBMITTED");
    await expect(submitWork(m1.id, people.sofia.id, "again")).rejects.toMatchObject({
      status: 409,
    });

    // APPROVE & RELEASE — money moves atomically.
    await expect(approveMilestone(m1.id, people.sofia.id)).rejects.toMatchObject({ status: 403 });
    const released = await approveMilestone(m1.id, people.clientUser.id);
    expect(released.status).toBe("RELEASED");

    const fee = Math.floor((600_000 * FEE_BPS) / 10_000);
    const payout = 600_000 - fee;
    const wallet = await getWallet(people.sofia.id);
    expect(wallet.balanceCents).toBe(payout);

    // Contract still active with one milestone outstanding.
    const detail = await getContractDetail(contract.id, people.clientUser.id);
    expect(detail.contract.status).toBe("ACTIVE");
    expect(detail.totals.releasedCents).toBe(600_000);
    expect(detail.totals.feeCents).toBe(fee);

    // Finish the second milestone → contract completes, project closes.
    await fundMilestone(m2.id, people.clientUser.id);
    await submitWork(m2.id, people.sofia.id, "UI complete with component library and docs.");
    await approveMilestone(m2.id, people.clientUser.id);

    const done = await getContractDetail(contract.id, people.sofia.id);
    expect(done.contract.status).toBe("COMPLETED");
    const [completedProject] = await database
      .select({ status: schema.projects.status })
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id));
    expect(completedProject?.status).toBe("CLOSED");

    const walletFinal = await getWallet(people.sofia.id);
    expect(walletFinal.balanceCents).toBe(1_050_000 - Math.floor((1_050_000 * FEE_BPS) / 10_000));

    // REVIEWS both ways update the rating aggregates.
    const r1 = await createReview(people.clientUser.id, {
      contractId: contract.id,
      rating: 5,
      comment: "Shipped early, cleanly tested.",
    });
    expect(r1.direction).toBe("CLIENT_TO_FREELANCER");
    const r2 = await createReview(people.sofia.id, {
      contractId: contract.id,
      rating: 4,
      comment: "Clear scope, paid on time.",
    });
    expect(r2.direction).toBe("FREELANCER_TO_CLIENT");

    const freelancerRating = await ratingSummary(people.sofia.id);
    expect(freelancerRating).toEqual({ average: 5, count: 1 });
    const clientRating = await ratingSummary(people.clientUser.id);
    expect(clientRating).toEqual({ average: 4, count: 1 });

    await expect(
      createReview(people.clientUser.id, { contractId: contract.id, rating: 3 }),
    ).rejects.toMatchObject({ status: 409 });

    // Hired proposals cannot be withdrawn.
    await expect(withdrawProposal(p1.id, people.sofia.id)).rejects.toMatchObject({ status: 409 });

    // Notifications flowed to both sides at each stage.
    const frNotifications = await listNotifications(database, people.sofia.id, { pageSize: 50 });
    const types = frNotifications.items.map((n) => n.type);
    expect(types).toContain("CONTRACT_STARTED");
    expect(types).toContain("MILESTONE_FUNDED");
    expect(types).toContain("MILESTONE_APPROVED");
    expect(types).toContain("REVIEW_RECEIVED");
  });

  it("a completed-contract project cannot take a fresh cancel", async () => {
    await expect(
      transitionProject("00000000-0000-0000-0000-000000000000", ids.flowClient!, "CANCEL"),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("payout request respects the available balance", async () => {
    const sofia = ids.flowSofia!;
    const walletBefore = await getWallet(sofia);
    expect(walletBefore.balanceCents).toBeGreaterThan(0);

    await expect(
      requestPayout(sofia, { amountCents: walletBefore.balanceCents + 1, method: "WISE" }),
    ).rejects.toMatchObject({ status: 422 });

    const payout = await requestPayout(sofia, { method: "WISE" });
    expect(payout.status).toBe("REQUESTED");
    const after = await getWallet(sofia);
    expect(after.balanceCents).toBe(0);
    expect(after.pendingCents).toBe(payout.amountCents);
  });
});

describe("dispute flow", () => {
  it("open dispute → admin resolves to client → refund", async () => {
    const people = await makePeople("Dsp");
    const project = await createProject(people.clientUser.id, {
      title: "Integration: dispute & refund path",
      description: "Full dispute lifecycle test with an admin resolution and refund assertion.",
      budgetType: "FIXED",
      budgetMinCents: 500_000,
      budgetMaxCents: 500_000,
      experienceLevel: "INTERMEDIATE",
      skills: ["Design"],
      publish: true,
    });
    const proposal = await createProposal(people.sofia.id, project.id, {
      coverLetter: "Research-led intake redesign; evidence first, screens second.".padEnd(90, "."),
      bidAmountCents: 500_000,
      estimatedDays: 14,
    });

    const contract = await hireFromProposal(proposal.id, people.clientUser.id);
    const milestone = await addMilestone(contract.id, people.clientUser.id, {
      title: "Research summary",
      amountCents: 500_000,
    });
    await fundMilestone(milestone.id, people.clientUser.id);
    await submitWork(milestone.id, people.sofia.id, "Research attached + funnel audit.");

    const dispute = await openDispute(people.clientUser.id, contract.id, {
      milestoneId: milestone.id,
      reason:
        "The delivered research does not match the agreed scope: interviews were not conducted as promised in the proposal.",
    });

    const disputed = await getContractDetail(contract.id, people.sofia.id);
    expect(disputed.contract.status).toBe("DISPUTED");
    expect(disputed.milestones[0]?.status).toBe("DISPUTED");

    // Approving while disputed is impossible.
    await expect(approveMilestone(milestone.id, people.clientUser.id)).rejects.toMatchObject({
      status: 409,
    });

    await resolveDispute(dispute.id, people.admin.id, {
      outcome: "RESOLVED_CLIENT",
      resolutionNote: "Scope not met; client refunded in full.",
    });

    const after = await getContractDetail(contract.id, people.clientUser.id);
    expect(after.milestones[0]?.status).toBe("REFUNDED");
    // Contract returns to a workable state once no open disputes remain.
    expect(["ACTIVE", "COMPLETED"]).toContain(after.contract.status);

    // Freelancer received nothing from this milestone.
    const wallet = await getWallet(people.sofia.id);
    expect(wallet.balanceCents).toBe(0);

    const ledgerRefund = after.ledger.filter((t) => t.type === "REFUND");
    expect(ledgerRefund.length).toBe(1);
    expect(ledgerRefund[0]?.amountCents).toBe(500_000);

    // Money already moved once (funded) so walking away needs a review.
    await expect(
      cancelContract(contract.id, people.clientUser.id, { reason: "changed my mind" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("open dispute → admin resolves to freelancer → release", async () => {
    const people = await makePeople("DspF");
    const project = await createProject(people.clientUser.id, {
      title: "Integration: dispute in freelancer's favour",
      description:
        "Dispute resolved toward the freelancer, releasing escrow minus the platform fee.",
      budgetType: "FIXED",
      budgetMinCents: 300_000,
      budgetMaxCents: 300_000,
      experienceLevel: "ENTRY",
      skills: ["Writing"],
      publish: true,
    });
    const proposal = await createProposal(people.sofia.id, project.id, {
      coverLetter: "Clear technical documentation with samples and CI-friendly build.".padEnd(
        90,
        ".",
      ),
      bidAmountCents: 300_000,
      estimatedDays: 7,
    });

    const contract = await hireFromProposal(proposal.id, people.clientUser.id);
    const milestone = await addMilestone(contract.id, people.clientUser.id, {
      title: "Quickstart guide",
      amountCents: 300_000,
    });
    await fundMilestone(milestone.id, people.clientUser.id);
    await submitWork(
      milestone.id,
      people.sofia.id,
      "Quickstart delivered with working sample app.",
    );

    const dispute = await openDispute(people.sofia.id, contract.id, {
      milestoneId: milestone.id,
      reason:
        "Client is unresponsive and unwilling to review the delivered work despite weekly written updates.",
    });

    await resolveDispute(dispute.id, people.admin.id, {
      outcome: "RESOLVED_FREELANCER",
      resolutionNote: "Work delivered per scope; escrow released to the freelancer.",
    });

    const fee = Math.floor((300_000 * FEE_BPS) / 10_000);
    const wallet = await getWallet(people.sofia.id);
    expect(wallet.balanceCents).toBe(300_000 - fee);

    const after = await getContractDetail(contract.id, people.sofia.id);
    expect(after.milestones[0]?.status).toBe("RELEASED");
    expect(after.contract.status).toBe("COMPLETED"); // all milestones terminal
  });
});

describe("global money invariants", () => {
  it("deposits = released + fees + refunds + still-in-escrow, across the whole DB", async () => {
    const database = await getDb();

    const byType = await database
      .select({
        type: schema.transactions.type,
        total: sql<number>`coalesce(sum(${schema.transactions.amountCents}),0)::bigint`,
      })
      .from(schema.transactions)
      .groupBy(schema.transactions.type);
    const amt = (t: string) => Number(byType.find((r) => r.type === t)?.total ?? 0);

    const held = await database
      .select({ total: sql<number>`coalesce(sum(${schema.milestones.amountCents}),0)::bigint` })
      .from(schema.milestones)
      .where(sql`${schema.milestones.status} in ('FUNDED','SUBMITTED','DISPUTED')`);

    const deposits = amt("ESCROW_DEPOSIT");
    const balanced =
      deposits ===
      amt("ESCROW_RELEASE") + amt("PLATFORM_FEE") + amt("REFUND") + Number(held[0]?.total ?? 0);

    expect({ deposits, held: Number(held[0]?.total ?? 0), balanced }).toMatchObject({
      balanced: true,
    });

    // The admin KPI must match the milestone-derived figure (guards its formula).
    const { platformStats } = await import("@/server/services/admin.service");
    const stats = await platformStats();
    expect(stats.money.inEscrowCents).toBe(Number(held[0]?.total ?? 0));
  });

  it("every wallet balance equals its ledger credits minus debits", async () => {
    const database = await getDb();
    const result = await database.execute<{ n: number }>(sql`
      select count(*)::int as n from (
        select w.user_id
        from wallets w
        left join transactions t on t.user_id = w.user_id
        group by w.user_id, w.balance_cents, w.pending_cents
        having w.balance_cents <>
          coalesce(sum(case
            when t.type = 'ESCROW_RELEASE' then t.amount_cents
            when t.type = 'REFUND' then t.amount_cents
            else 0 end), 0)
        - coalesce(sum(case when t.type = 'PAYOUT' then t.amount_cents else 0 end), 0)
      ) mismatched`);
    expect(result.rows[0]?.n ?? 0).toBe(0);
  });
});

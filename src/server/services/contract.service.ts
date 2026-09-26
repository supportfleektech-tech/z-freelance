import { aliasedTable, and, desc, eq, inArray, sql } from "drizzle-orm";
import { db as getDb, type Tx } from "@/lib/db";
import {
  clientProfiles,
  contracts,
  disputes,
  freelancerProfiles,
  milestones,
  payouts,
  projects,
  proposals,
  transactions,
  users,
  wallets,
  type Contract,
  type Milestone,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { config } from "@/lib/config";
import { freelancerPayoutCents, platformFeeCents } from "@/lib/money";
import { notify } from "./notification.service";
import { linkAttachments } from "./storage.service";
import { getOrCreateThread } from "./messaging.service";
import { assertProposalOpenForHire } from "./proposal.service";
import { markProjectInProgress, notifyNonHiredProposers } from "./project.service";
import type {
  CancelContractInput,
  CreateMilestoneInput,
  OpenDisputeInput,
  RequestPayoutInput,
  ResolveDisputeInput,
} from "@/lib/validation";

/** Second reference to `users` so a contract can carry both parties' names. */
const freelancerUser = aliasedTable(users, "freelancer_user");

/* ----------------------------------------------------------------- hiring */

/**
 * Turn an accepted proposal into a contract.
 *
 * Everything happens in one transaction: the proposal flips to HIRED, the
 * contract row is created with the platform fee frozen at today's rate, the
 * project moves to IN_PROGRESS, competing proposals are rejected and both
 * sides are notified. A failure anywhere rolls the whole thing back.
 */
export async function hireFromProposal(proposalId: string, clientId: string): Promise<Contract> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const { proposal, project } = await assertProposalOpenForHire(tx, proposalId);
    if (project.clientId !== clientId) {
      throw ApiError.forbidden("You do not own this project.");
    }

    const [hired] = await tx
      .update(proposals)
      .set({ status: "HIRED", decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(proposals.id, proposalId))
      .returning();
    if (!hired) throw new Error("proposal update returned no row");

    const [contract] = await tx
      .insert(contracts)
      .values({
        projectId: project.id,
        proposalId,
        clientId,
        freelancerId: proposal.freelancerId,
        title: project.title,
        amountCents: proposal.bidAmountCents,
        platformFeeBps: config.platformFeeBps,
      })
      .returning();
    if (!contract) throw new Error("contract insert returned no row");

    await markProjectInProgress(tx, project.id);
    await notifyNonHiredProposers(tx, project.id, proposalId, project.title);

    await getOrCreateThread(tx, {
      participantAId: clientId,
      participantBId: proposal.freelancerId,
      subject: `Contract · ${project.title}`,
      contractId: contract.id,
      projectId: project.id,
    });

    await notify(tx, {
      userId: proposal.freelancerId,
      type: "CONTRACT_STARTED",
      title: `You were hired for “${project.title}”`,
      body: "Add milestones so the client can fund the work in escrow.",
      link: `/dashboard/contracts/${contract.id}`,
    });

    return contract;
  });
}

/* --------------------------------------------------------------- reading */

export interface ContractSummary extends Contract {
  projectTitle: string;
  counterpartyName: string;
  counterpartyId: string;
  fundedCents: number;
  releasedCents: number;
  milestoneCount: number;
  openMilestoneCount: number;
}

/** Contracts for one user, as either the client or the freelancer. */
export async function listContractsForUser(userId: string): Promise<ContractSummary[]> {
  const database = await getDb();

  const rows = await database
    .select({
      contract: contracts,
      projectTitle: projects.title,
      clientName: users.name,
      freelancerName: freelancerUser.name,
    })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(users, eq(users.id, contracts.clientId))
    .innerJoin(freelancerUser, eq(freelancerUser.id, contracts.freelancerId))
    .where(sql`${contracts.clientId} = ${userId} or ${contracts.freelancerId} = ${userId}`)
    .orderBy(desc(contracts.startedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.contract.id);
  const stats = await database
    .select({
      contractId: milestones.contractId,
      funded: sql<number>`coalesce(sum(case when ${milestones.status} in ('FUNDED','SUBMITTED','RELEASED') then ${milestones.amountCents} else 0 end), 0)::bigint`,
      released: sql<number>`coalesce(sum(case when ${milestones.status} = 'RELEASED' then ${milestones.amountCents} else 0 end), 0)::bigint`,
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${milestones.status} in ('PENDING','FUNDED','SUBMITTED','DISPUTED'))::int`,
    })
    .from(milestones)
    .where(inArray(milestones.contractId, ids))
    .groupBy(milestones.contractId);

  const byContract = new Map(stats.map((s) => [s.contractId, s]));

  return rows.map((row) => {
    const stat = byContract.get(row.contract.id);
    const isClient = row.contract.clientId === userId;
    return {
      ...row.contract,
      projectTitle: row.projectTitle,
      counterpartyName: isClient ? row.freelancerName : row.clientName,
      counterpartyId: isClient ? row.contract.freelancerId : row.contract.clientId,
      fundedCents: Number(stat?.funded ?? 0),
      releasedCents: Number(stat?.released ?? 0),
      milestoneCount: stat?.total ?? 0,
      openMilestoneCount: stat?.open ?? 0,
    };
  });
}

export interface ContractDetail {
  contract: Contract;
  project: { id: string; title: string; status: Contract["status"] | string };
  client: { id: string; name: string };
  freelancer: { id: string; name: string; headline: string | null; rating: number };
  milestones: Milestone[];
  ledger: Array<typeof transactions.$inferSelect>;
  disputes: Array<typeof disputes.$inferSelect>;
  totals: {
    amountCents: number;
    plannedCents: number;
    fundedCents: number;
    releasedCents: number;
    feeCents: number;
    freelancerNetCents: number;
    remainingCents: number;
  };
}

/** Everything the contract workspace needs, with the money already totalled. */
export async function getContractDetail(
  contractId: string,
  viewerId: string,
): Promise<ContractDetail> {
  const database = await getDb();

  const rows = await database
    .select({
      contract: contracts,
      projectTitle: projects.title,
      projectStatus: projects.status,
      clientName: users.name,
    })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(users, eq(users.id, contracts.clientId))
    .where(eq(contracts.id, contractId))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound("Contract not found.");
  const { contract } = row;
  if (contract.clientId !== viewerId && contract.freelancerId !== viewerId) {
    throw ApiError.forbidden("You are not a party to this contract.");
  }

  const [freelancerRow] = await database
    .select({
      id: users.id,
      name: users.name,
      headline: freelancerProfiles.headline,
      rating: freelancerProfiles.ratingAvg,
    })
    .from(users)
    .leftJoin(freelancerProfiles, eq(freelancerProfiles.userId, users.id))
    .where(eq(users.id, contract.freelancerId))
    .limit(1);

  const [milestoneRows, ledger, disputeRows] = await Promise.all([
    database
      .select()
      .from(milestones)
      .where(eq(milestones.contractId, contractId))
      .orderBy(milestones.position, milestones.createdAt),
    database
      .select()
      .from(transactions)
      .where(eq(transactions.contractId, contractId))
      .orderBy(desc(transactions.createdAt)),
    database
      .select()
      .from(disputes)
      .where(eq(disputes.contractId, contractId))
      .orderBy(desc(disputes.createdAt)),
  ]);

  const plannedCents = milestoneRows.reduce((t, m) => t + m.amountCents, 0);
  const fundedCents = milestoneRows
    .filter((m) => ["FUNDED", "SUBMITTED", "RELEASED"].includes(m.status))
    .reduce((t, m) => t + m.amountCents, 0);
  const releasedCents = milestoneRows
    .filter((m) => m.status === "RELEASED")
    .reduce((t, m) => t + m.amountCents, 0);
  const feeCents = milestoneRows
    .filter((m) => m.status === "RELEASED")
    .reduce((t, m) => t + platformFeeCents(m.amountCents, contract.platformFeeBps), 0);

  return {
    contract,
    project: { id: contract.projectId, title: row.projectTitle, status: row.projectStatus },
    client: { id: contract.clientId, name: row.clientName },
    freelancer: {
      id: contract.freelancerId,
      name: freelancerRow?.name ?? "Freelancer",
      headline: freelancerRow?.headline ?? null,
      rating: freelancerRow?.rating ?? 0,
    },
    milestones: milestoneRows,
    ledger,
    disputes: disputeRows,
    totals: {
      amountCents: contract.amountCents,
      plannedCents,
      fundedCents,
      releasedCents,
      feeCents,
      freelancerNetCents: releasedCents - feeCents,
      remainingCents: Math.max(0, contract.amountCents - plannedCents),
    },
  };
}

/* ------------------------------------------------------------- milestones */

async function loadContractFor(
  tx: Tx,
  contractId: string,
  userId: string,
  role: "client" | "freelancer",
) {
  const [contract] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
  if (!contract) throw ApiError.notFound("Contract not found.");
  const expected = role === "client" ? contract.clientId : contract.freelancerId;
  if (expected !== userId) {
    throw ApiError.forbidden(`Only the ${role} can perform this action.`);
  }
  return contract;
}

async function plannedTotal(tx: Tx, contractId: string): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`coalesce(sum(${milestones.amountCents}), 0)::bigint` })
    .from(milestones)
    .where(eq(milestones.contractId, contractId));
  return Number(row?.value ?? 0);
}

/** Add a single milestone; the plan may never exceed the contract value. */
export async function addMilestone(
  contractId: string,
  clientId: string,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const contract = await loadContractFor(tx, contractId, clientId, "client");
    if (contract.status !== "ACTIVE") {
      throw ApiError.conflict("Milestones can only be added to an active contract.");
    }

    const planned = await plannedTotal(tx, contractId);
    if (planned + input.amountCents > contract.amountCents) {
      throw ApiError.unprocessable(
        `Milestones may not exceed the contract value. ${contract.amountCents - planned} cents remain unallocated.`,
      );
    }

    const [position] = await tx
      .select({ value: sql<number>`coalesce(max(${milestones.position}), 0)::int` })
      .from(milestones)
      .where(eq(milestones.contractId, contractId));

    const [milestone] = await tx
      .insert(milestones)
      .values({
        contractId,
        title: input.title,
        description: input.description ?? null,
        amountCents: input.amountCents,
        dueDate: input.dueDate ?? null,
        position: input.position ?? (position?.value ?? 0) + 1,
      })
      .returning();
    if (!milestone) throw new Error("milestone insert returned no row");
    return milestone;
  });
}

/**
 * Replace the whole milestone plan.
 *
 * The plan must total exactly the contract value — that is what makes escrow
 * balanced by construction: every cent the client deposits is accounted for.
 */
export async function setMilestonePlan(
  contractId: string,
  clientId: string,
  plan: CreateMilestoneInput[],
): Promise<Milestone[]> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const contract = await loadContractFor(tx, contractId, clientId, "client");
    if (contract.status !== "ACTIVE") {
      throw ApiError.conflict("Milestones can only be planned on an active contract.");
    }

    const [funded] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(milestones)
      .where(and(eq(milestones.contractId, contractId), sql`${milestones.status} <> 'PENDING'`));
    if ((funded?.value ?? 0) > 0) {
      throw ApiError.conflict("The plan cannot be replaced once a milestone has been funded.");
    }

    const total = plan.reduce((t, m) => t + m.amountCents, 0);
    if (total !== contract.amountCents) {
      throw ApiError.unprocessable(
        `Milestone plan must total exactly the contract value (${contract.amountCents} cents, got ${total}).`,
      );
    }

    await tx.delete(milestones).where(eq(milestones.contractId, contractId));

    const created = await tx
      .insert(milestones)
      .values(
        plan.map((m, index) => ({
          contractId,
          title: m.title,
          description: m.description ?? null,
          amountCents: m.amountCents,
          dueDate: m.dueDate ?? null,
          position: index + 1,
        })),
      )
      .returning();

    return created;
  });
}

/** Client deposits the milestone amount into escrow. */
export async function fundMilestone(milestoneId: string, clientId: string): Promise<Milestone> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const milestone = await mustGetMilestone(tx, milestoneId);
    const contract = await loadContractFor(tx, milestone.contractId, clientId, "client");

    if (contract.status !== "ACTIVE") {
      throw ApiError.conflict("This contract is not active.");
    }
    if (milestone.status !== "PENDING") {
      throw ApiError.conflict(
        `Only pending milestones can be funded (this one is ${milestone.status}).`,
      );
    }

    const reference = `esc_${milestoneId.slice(0, 8)}_${Date.now().toString(36)}`;
    const [updated] = await tx
      .update(milestones)
      .set({
        status: "FUNDED",
        fundedAt: new Date(),
        escrowReference: reference,
        updatedAt: new Date(),
      })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.status, "PENDING")))
      .returning();
    if (!updated) throw ApiError.conflict("This milestone was funded by another request.");

    await tx.insert(transactions).values({
      userId: contract.clientId,
      contractId: contract.id,
      milestoneId,
      type: "ESCROW_DEPOSIT",
      amountCents: milestone.amountCents,
      reference,
      meta: { milestoneTitle: milestone.title },
    });

    await notify(tx, {
      userId: contract.freelancerId,
      type: "MILESTONE_FUNDED",
      title: `Funds in escrow · ${milestone.title}`,
      body: "The client funded this milestone. You can start the work.",
      link: `/dashboard/contracts/${contract.id}`,
    });

    return updated;
  });
}

/** Freelancer marks the milestone as delivered. */
export async function submitWork(
  milestoneId: string,
  freelancerId: string,
  submissionNote: string,
  attachmentIds: string[] = [],
): Promise<Milestone> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const milestone = await mustGetMilestone(tx, milestoneId);
    const contract = await loadContractFor(tx, milestone.contractId, freelancerId, "freelancer");

    if (milestone.status !== "FUNDED") {
      throw ApiError.conflict("Only funded milestones can be submitted for review.");
    }

    const [updated] = await tx
      .update(milestones)
      .set({ status: "SUBMITTED", submittedAt: new Date(), submissionNote, updatedAt: new Date() })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.status, "FUNDED")))
      .returning();
    if (!updated) throw ApiError.conflict("This milestone has already moved on.");

    // Deliverable files — linked atomically with the submission. A bad
    // attachment reference rolls the submission back instead of losing files.
    await linkAttachments(tx, {
      uploaderId: freelancerId,
      attachmentIds,
      context: "MILESTONE",
      milestoneId,
    });

    await notify(tx, {
      userId: contract.clientId,
      type: "WORK_SUBMITTED",
      title: `Work submitted · ${milestone.title}`,
      body: "Review the delivery and release the escrowed funds.",
      link: `/dashboard/contracts/${contract.id}`,
    });

    return updated;
  });
}

/**
 * Client approves the delivery, which releases escrow.
 *
 * This is the single money-moving operation on the freelancer side and it is
 * atomic: the milestone flips to RELEASED, the platform fee and the net payout
 * are written to the ledger, the freelancer's wallet balance is credited, and
 * lifetime counters are updated — all or nothing.
 */
export async function approveMilestone(milestoneId: string, clientId: string): Promise<Milestone> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const milestone = await mustGetMilestone(tx, milestoneId);
    const contract = await loadContractFor(tx, milestone.contractId, clientId, "client");

    if (milestone.status !== "SUBMITTED") {
      throw ApiError.conflict("Only submitted work can be approved and released.");
    }

    const fee = platformFeeCents(milestone.amountCents, contract.platformFeeBps);
    const payout = freelancerPayoutCents(milestone.amountCents, contract.platformFeeBps);
    const now = new Date();

    const [updated] = await tx
      .update(milestones)
      .set({ status: "RELEASED", approvedAt: now, releasedAt: now, updatedAt: now })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.status, "SUBMITTED")))
      .returning();
    if (!updated) throw ApiError.conflict("This milestone has already been processed.");

    await tx.insert(transactions).values([
      {
        userId: contract.freelancerId,
        contractId: contract.id,
        milestoneId,
        type: "ESCROW_RELEASE",
        amountCents: payout,
        reference: milestone.escrowReference,
        meta: { grossCents: milestone.amountCents, feeCents: fee, feeBps: contract.platformFeeBps },
      },
      {
        userId: contract.clientId,
        contractId: contract.id,
        milestoneId,
        type: "PLATFORM_FEE",
        amountCents: fee,
        reference: milestone.escrowReference,
        meta: { feeBps: contract.platformFeeBps },
      },
    ]);

    await creditWallet(tx, contract.freelancerId, payout);

    await tx
      .update(freelancerProfiles)
      .set({
        totalEarnedCents: sql`${freelancerProfiles.totalEarnedCents} + ${payout}`,
        updatedAt: now,
      })
      .where(eq(freelancerProfiles.userId, contract.freelancerId));

    await tx
      .update(clientProfiles)
      .set({
        totalSpentCents: sql`${clientProfiles.totalSpentCents} + ${milestone.amountCents}`,
        updatedAt: now,
      })
      .where(eq(clientProfiles.userId, contract.clientId));

    await notify(tx, {
      userId: contract.freelancerId,
      type: "MILESTONE_APPROVED",
      title: `Payment released · ${milestone.title}`,
      body: "The client approved your work and the escrowed funds were released.",
      link: `/dashboard/contracts/${contract.id}`,
    });

    await maybeCompleteContract(tx, contract.id);

    return updated;
  });
}

/** Complete the contract once every milestone has been released. */
async function maybeCompleteContract(tx: Tx, contractId: string): Promise<void> {
  const [row] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      released: sql<number>`count(*) filter (where ${milestones.status} = 'RELEASED')::int`,
    })
    .from(milestones)
    .where(eq(milestones.contractId, contractId));

  if (!row || row.total === 0 || row.released !== row.total) return;

  const [contract] = await tx
    .update(contracts)
    .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contracts.id, contractId), eq(contracts.status, "ACTIVE")))
    .returning();
  if (!contract) return;

  await tx
    .update(freelancerProfiles)
    .set({ completedContracts: sql`${freelancerProfiles.completedContracts} + 1` })
    .where(eq(freelancerProfiles.userId, contract.freelancerId));

  await tx
    .update(projects)
    .set({ status: "CLOSED", closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, contract.projectId), eq(projects.status, "IN_PROGRESS")));

  await notify(tx, {
    userId: contract.clientId,
    type: "CONTRACT_STARTED",
    title: `Contract complete · ${contract.title}`,
    body: "Every milestone has been released. Leave a review for your freelancer.",
    link: `/dashboard/contracts/${contract.id}`,
  });
  await notify(tx, {
    userId: contract.freelancerId,
    type: "CONTRACT_STARTED",
    title: `Contract complete · ${contract.title}`,
    body: "Nice work. Leave a review for your client.",
    link: `/dashboard/contracts/${contract.id}`,
  });
}

/* --------------------------------------------------------------- disputes */

export async function openDispute(
  actorId: string,
  contractId: string,
  input: OpenDisputeInput,
): Promise<typeof disputes.$inferSelect> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
    if (!contract) throw ApiError.notFound("Contract not found.");
    if (contract.clientId !== actorId && contract.freelancerId !== actorId) {
      throw ApiError.forbidden("You are not a party to this contract.");
    }
    if (contract.status === "COMPLETED" || contract.status === "CANCELLED") {
      throw ApiError.conflict("A finished contract cannot be disputed.");
    }

    let milestone: Milestone | undefined;
    if (input.milestoneId) {
      milestone = await mustGetMilestone(tx, input.milestoneId);
      if (milestone.contractId !== contractId) {
        throw ApiError.badRequest("That milestone belongs to a different contract.");
      }
      if (!["FUNDED", "SUBMITTED"].includes(milestone.status)) {
        throw ApiError.conflict("Only funded or submitted milestones can be disputed.");
      }
      await tx
        .update(milestones)
        .set({ status: "DISPUTED", updatedAt: new Date() })
        .where(eq(milestones.id, milestone.id));
    }

    await tx
      .update(contracts)
      .set({ status: "DISPUTED", updatedAt: new Date() })
      .where(eq(contracts.id, contractId));

    const [dispute] = await tx
      .insert(disputes)
      .values({
        contractId,
        milestoneId: milestone?.id ?? null,
        openedBy: actorId,
        reason: input.reason,
      })
      .returning();
    if (!dispute) throw new Error("dispute insert returned no row");

    const counterparty = contract.clientId === actorId ? contract.freelancerId : contract.clientId;
    await notify(tx, {
      userId: counterparty,
      type: "DISPUTE_OPENED",
      title: `A dispute was opened · ${contract.title}`,
      body: "Our team will review the case. Funds stay in escrow until it is resolved.",
      link: `/dashboard/contracts/${contract.id}`,
    });

    const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN"));
    for (const admin of admins) {
      await notify(tx, {
        userId: admin.id,
        type: "DISPUTE_OPENED",
        title: `New dispute on ${contract.title}`,
        link: `/admin/disputes`,
      });
    }

    return dispute;
  });
}

/**
 * Admin decision on a dispute.
 *
 * - RESOLVED_FREELANCER -> the disputed milestone is released to the freelancer.
 * - RESOLVED_CLIENT     -> the disputed milestone is refunded to the client.
 */
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  input: ResolveDisputeInput,
): Promise<void> {
  const database = await getDb();

  await database.transaction(async (tx) => {
    const [dispute] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
    if (!dispute) throw ApiError.notFound("Dispute not found.");
    if (!["OPEN", "IN_REVIEW"].includes(dispute.status)) {
      throw ApiError.conflict("This dispute has already been resolved.");
    }

    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, dispute.contractId))
      .limit(1);
    if (!contract) throw ApiError.notFound("Contract not found.");

    if (dispute.milestoneId) {
      const milestone = await mustGetMilestone(tx, dispute.milestoneId);
      if (input.outcome === "RESOLVED_FREELANCER") {
        const fee = platformFeeCents(milestone.amountCents, contract.platformFeeBps);
        const payout = freelancerPayoutCents(milestone.amountCents, contract.platformFeeBps);
        const now = new Date();

        await tx
          .update(milestones)
          .set({ status: "RELEASED", approvedAt: now, releasedAt: now, updatedAt: now })
          .where(eq(milestones.id, milestone.id));

        await tx.insert(transactions).values([
          {
            userId: contract.freelancerId,
            contractId: contract.id,
            milestoneId: milestone.id,
            type: "ESCROW_RELEASE",
            amountCents: payout,
            reference: `dispute_${dispute.id.slice(0, 8)}`,
            meta: { grossCents: milestone.amountCents, feeCents: fee, viaDispute: true },
          },
          {
            userId: contract.clientId,
            contractId: contract.id,
            milestoneId: milestone.id,
            type: "PLATFORM_FEE",
            amountCents: fee,
            reference: `dispute_${dispute.id.slice(0, 8)}`,
            meta: { feeBps: contract.platformFeeBps, viaDispute: true },
          },
        ]);

        await creditWallet(tx, contract.freelancerId, payout);
        await tx
          .update(freelancerProfiles)
          .set({ totalEarnedCents: sql`${freelancerProfiles.totalEarnedCents} + ${payout}` })
          .where(eq(freelancerProfiles.userId, contract.freelancerId));
      } else {
        await tx
          .update(milestones)
          .set({ status: "REFUNDED", updatedAt: new Date() })
          .where(eq(milestones.id, milestone.id));

        await tx.insert(transactions).values({
          userId: contract.clientId,
          contractId: contract.id,
          milestoneId: milestone.id,
          type: "REFUND",
          amountCents: milestone.amountCents,
          reference: `dispute_${dispute.id.slice(0, 8)}`,
          meta: { viaDispute: true },
        });

        // Refunded escrow lands in the client's platform wallet — withdrawable,
        // and visible in their ledger. Keeps wallet = ledger, for everyone.
        await creditWallet(tx, contract.clientId, milestone.amountCents);
      }
    }

    await tx
      .update(disputes)
      .set({
        status: input.outcome,
        resolutionNote: input.resolutionNote,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId));

    // Return the contract to a workable state once no dispute is open.
    const [remaining] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(disputes)
      .where(
        and(eq(disputes.contractId, contract.id), inArray(disputes.status, ["OPEN", "IN_REVIEW"])),
      );

    if ((remaining?.value ?? 0) === 0) {
      await tx
        .update(contracts)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(and(eq(contracts.id, contract.id), eq(contracts.status, "DISPUTED")));
      await maybeCompleteContract(tx, contract.id);
    }

    for (const userId of [contract.clientId, contract.freelancerId]) {
      await notify(tx, {
        userId,
        type: "DISPUTE_RESOLVED",
        title: `Dispute resolved · ${contract.title}`,
        body: input.resolutionNote,
        link: `/dashboard/contracts/${contract.id}`,
      });
    }
  });
}

/** Cancel a contract before any money moves. */
export async function cancelContract(
  contractId: string,
  actorId: string,
  input: CancelContractInput,
): Promise<Contract> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);
    if (!contract) throw ApiError.notFound("Contract not found.");
    if (contract.clientId !== actorId && contract.freelancerId !== actorId) {
      throw ApiError.forbidden("You are not a party to this contract.");
    }
    if (contract.status !== "ACTIVE")
      throw ApiError.conflict("Only active contracts can be cancelled.");

    const [funded] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(milestones)
      .where(and(eq(milestones.contractId, contractId), sql`${milestones.status} <> 'PENDING'`));

    if ((funded?.value ?? 0) > 0) {
      throw ApiError.conflict(
        "Money is already in escrow. Open a dispute so our team can decide how it is returned.",
      );
    }

    const [updated] = await tx
      .update(contracts)
      .set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contractId))
      .returning();

    await tx.delete(milestones).where(eq(milestones.contractId, contractId));

    await tx
      .update(projects)
      .set({ status: "OPEN", updatedAt: new Date() })
      .where(and(eq(projects.id, contract.projectId), eq(projects.status, "IN_PROGRESS")));

    const counterparty = contract.clientId === actorId ? contract.freelancerId : contract.clientId;
    await notify(tx, {
      userId: counterparty,
      type: "CONTRACT_STARTED",
      title: `Contract cancelled · ${contract.title}`,
      body: input.reason,
      link: `/dashboard/contracts/${contract.id}`,
    });

    return updated as Contract;
  });
}

/* ---------------------------------------------------------------- payouts */

export async function getWallet(userId: string) {
  const database = await getDb();
  const [wallet] = await database.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (!wallet) throw ApiError.notFound("Wallet not found.");
  return wallet;
}

export async function listLedger(userId: string, limit = 50) {
  const database = await getDb();
  return database
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

export async function listPayouts(userId: string) {
  const database = await getDb();
  return database
    .select()
    .from(payouts)
    .where(eq(payouts.freelancerId, userId))
    .orderBy(desc(payouts.requestedAt));
}

/** Move wallet balance into a payout request. */
export async function requestPayout(
  freelancerId: string,
  input: RequestPayoutInput,
): Promise<typeof payouts.$inferSelect> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, freelancerId))
      .limit(1);
    if (!wallet) throw ApiError.notFound("Wallet not found.");

    const amount = input.amountCents ?? wallet.balanceCents;
    if (amount <= 0) throw ApiError.badRequest("There is nothing to withdraw yet.");
    if (amount > wallet.balanceCents) {
      throw ApiError.unprocessable("You cannot withdraw more than your available balance.");
    }

    await tx
      .update(wallets)
      .set({
        balanceCents: sql`${wallets.balanceCents} - ${amount}`,
        pendingCents: sql`${wallets.pendingCents} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, freelancerId));

    const [payout] = await tx
      .insert(payouts)
      .values({
        freelancerId,
        amountCents: amount,
        method: input.method,
        reference: `po_${Date.now().toString(36)}`,
      })
      .returning();
    if (!payout) throw new Error("payout insert returned no row");

    await tx.insert(transactions).values({
      userId: freelancerId,
      type: "PAYOUT",
      amountCents: amount,
      reference: payout.reference,
      meta: { method: payout.method, payoutId: payout.id },
    });

    return payout;
  });
}

/** Admin marks a payout as transferred. */
export async function markPayoutPaid(payoutId: string, _adminId: string): Promise<void> {
  const database = await getDb();

  await database.transaction(async (tx) => {
    const [payout] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
    if (!payout) throw ApiError.notFound("Payout not found.");
    if (payout.status === "PAID") throw ApiError.conflict("This payout is already marked paid.");

    await tx
      .update(payouts)
      .set({ status: "PAID", paidAt: new Date() })
      .where(eq(payouts.id, payoutId));

    await tx
      .update(wallets)
      .set({ pendingCents: sql`greatest(${wallets.pendingCents} - ${payout.amountCents}, 0)` })
      .where(eq(wallets.userId, payout.freelancerId));

    await notify(tx, {
      userId: payout.freelancerId,
      type: "PAYOUT_PAID",
      title: "Your withdrawal was paid",
      body: `${payout.amountCents / 100} has been sent via ${payout.method}.`,
      link: "/dashboard/earnings",
    });
  });
}

/* ---------------------------------------------------------------- helpers */

/** Credit a freelancer's wallet, creating the row on first use. */
async function creditWallet(tx: Tx, userId: string, amountCents: number): Promise<void> {
  const updated = await tx
    .update(wallets)
    .set({ balanceCents: sql`${wallets.balanceCents} + ${amountCents}`, updatedAt: new Date() })
    .where(eq(wallets.userId, userId))
    .returning({ id: wallets.id });

  if (updated.length === 0) {
    await tx
      .insert(wallets)
      .values({ userId, balanceCents: amountCents, pendingCents: 0 })
      .onConflictDoNothing({ target: wallets.userId });
  }
}

async function mustGetMilestone(tx: Tx, milestoneId: string): Promise<Milestone> {
  const [milestone] = await tx
    .select()
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  if (!milestone) throw ApiError.notFound("Milestone not found.");
  return milestone;
}

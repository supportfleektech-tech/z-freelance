import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db as getDb, type Tx } from "@/lib/db";
import {
  contracts,
  freelancerProfiles,
  projects,
  proposals,
  skills,
  freelancerSkills,
  users,
  type Proposal,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { notify } from "./notification.service";
import { refreshProposalCount } from "./project.service";
import { getOrCreateThread, sendMessage } from "./messaging.service";
import type { CreateProposalInput } from "@/lib/validation";

export interface ProposalWithFreelancer extends Proposal {
  freelancerName: string;
  freelancerHeadline: string | null;
  freelancerRating: number;
  freelancerRatingCount: number;
  freelancerHourlyRateCents: number | null;
  freelancerYearsExperience: number;
  freelancerSkills: string[];
}

/**
 * Submit a proposal.
 *
 * Business rules enforced here (and covered by the test-suite):
 * - only OPEN projects accept proposals;
 * - only accounts with a freelancer profile may bid;
 * - one proposal per freelancer per project (also backed by a unique index);
 * - you cannot bid on a project that already has an active contract.
 */
export async function createProposal(
  freelancerId: string,
  projectId: string,
  input: CreateProposalInput,
): Promise<Proposal> {
  const database = await getDb();

  const [profile] = await database
    .select()
    .from(freelancerProfiles)
    .where(eq(freelancerProfiles.userId, freelancerId))
    .limit(1);
  if (!profile) {
    throw ApiError.forbidden("Complete your freelancer profile before submitting proposals.");
  }

  return database.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) throw ApiError.notFound("Project not found.");
    if (project.clientId === freelancerId) {
      throw ApiError.badRequest("You cannot submit a proposal on your own project.");
    }
    if (project.status !== "OPEN") {
      throw ApiError.conflict("This project is no longer accepting proposals.");
    }

    const [existingContract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.projectId, projectId), eq(contracts.status, "ACTIVE")))
      .limit(1);
    if (existingContract) {
      throw ApiError.conflict("This project has already been awarded to a freelancer.");
    }

    const [duplicate] = await tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.projectId, projectId), eq(proposals.freelancerId, freelancerId)))
      .limit(1);
    if (duplicate)
      throw ApiError.conflict("You have already submitted a proposal for this project.");

    const [proposal] = await tx
      .insert(proposals)
      .values({
        projectId,
        freelancerId,
        coverLetter: input.coverLetter,
        bidAmountCents: input.bidAmountCents,
        estimatedDays: input.estimatedDays,
      })
      .returning();
    if (!proposal) throw new Error("proposal insert returned no row");

    await refreshProposalCount(tx, projectId);

    await notify(tx, {
      userId: project.clientId,
      type: "PROPOSAL_RECEIVED",
      title: `New proposal for “${project.title}”`,
      body: "A freelancer just submitted a proposal — review it before it gets buried.",
      link: `/dashboard/projects/${project.id}`,
    });

    return proposal;
  });
}

/** Proposals received on one of the client's projects, with freelancer context. */
export async function listProposalsForProject(
  projectId: string,
): Promise<ProposalWithFreelancer[]> {
  const database = await getDb();

  const rows = await database
    .select({
      proposal: proposals,
      name: users.name,
      headline: freelancerProfiles.headline,
      rating: freelancerProfiles.ratingAvg,
      ratingCount: freelancerProfiles.ratingCount,
      hourlyRate: freelancerProfiles.hourlyRateCents,
      yearsExperience: freelancerProfiles.yearsExperience,
      profileId: freelancerProfiles.id,
    })
    .from(proposals)
    .innerJoin(users, eq(users.id, proposals.freelancerId))
    .leftJoin(freelancerProfiles, eq(freelancerProfiles.userId, proposals.freelancerId))
    .where(eq(proposals.projectId, projectId))
    .orderBy(desc(proposals.createdAt));

  const profileIds = rows.map((r) => r.profileId).filter((id): id is string => Boolean(id));
  const skillRows =
    profileIds.length > 0
      ? await database
          .select({ profileId: freelancerSkills.profileId, name: skills.name })
          .from(freelancerSkills)
          .innerJoin(skills, eq(skills.id, freelancerSkills.skillId))
          .where(inArray(freelancerSkills.profileId, profileIds))
      : [];

  const skillsByProfile = new Map<string, string[]>();
  for (const row of skillRows) {
    const list = skillsByProfile.get(row.profileId) ?? [];
    list.push(row.name);
    skillsByProfile.set(row.profileId, list);
  }

  return rows.map((row) => ({
    ...row.proposal,
    freelancerName: row.name,
    freelancerHeadline: row.headline ?? null,
    freelancerRating: row.rating ?? 0,
    freelancerRatingCount: row.ratingCount ?? 0,
    freelancerHourlyRateCents: row.hourlyRate ?? null,
    freelancerYearsExperience: row.yearsExperience ?? 0,
    freelancerSkills: row.profileId ? (skillsByProfile.get(row.profileId) ?? []) : [],
  }));
}

/** Every proposal a freelancer has submitted, newest first. */
export async function listFreelancerProposals(freelancerId: string) {
  const database = await getDb();
  return database
    .select({
      proposal: proposals,
      projectTitle: projects.title,
      projectId: projects.id,
      projectStatus: projects.status,
      budgetType: projects.budgetType,
      budgetMinCents: projects.budgetMinCents,
      budgetMaxCents: projects.budgetMaxCents,
      clientName: users.name,
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .innerJoin(users, eq(users.id, projects.clientId))
    .where(eq(proposals.freelancerId, freelancerId))
    .orderBy(desc(proposals.createdAt));
}

/** Shortlist or reject a proposal. Hiring lives in the contract service. */
export async function decideProposal(
  proposalId: string,
  clientId: string,
  decision: "SHORTLIST" | "REJECT",
): Promise<Proposal> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const { proposal, project } = await loadProposalForClient(tx, proposalId, clientId);

    if (proposal.status === "HIRED") {
      throw ApiError.conflict("This proposal has already been hired.");
    }
    if (proposal.status === "WITHDRAWN") {
      throw ApiError.conflict("This proposal was withdrawn by the freelancer.");
    }

    const status = decision === "SHORTLIST" ? "SHORTLISTED" : "REJECTED";
    const [updated] = await tx
      .update(proposals)
      .set({ status, decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(proposals.id, proposalId))
      .returning();

    await notify(tx, {
      userId: proposal.freelancerId,
      type: decision === "SHORTLIST" ? "PROPOSAL_SHORTLISTED" : "PROPOSAL_REJECTED",
      title:
        decision === "SHORTLIST"
          ? `You were shortlisted for “${project.title}”`
          : `Update on your proposal for “${project.title}”`,
      body:
        decision === "SHORTLIST"
          ? "The client shortlisted your proposal. Expect a message soon."
          : "The client decided to move in a different direction.",
      link: "/dashboard/proposals",
    });

    return updated as Proposal;
  });
}

/** A freelancer withdraws their own proposal. */
export async function withdrawProposal(
  proposalId: string,
  freelancerId: string,
): Promise<Proposal> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const [proposal] = await tx
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);
    if (!proposal) throw ApiError.notFound("Proposal not found.");
    if (proposal.freelancerId !== freelancerId) {
      throw ApiError.forbidden("You do not own this proposal.");
    }
    if (proposal.status === "HIRED") {
      throw ApiError.conflict("A hired proposal can no longer be withdrawn.");
    }

    const [updated] = await tx
      .update(proposals)
      .set({ status: "WITHDRAWN", decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(proposals.id, proposalId))
      .returning();

    await refreshProposalCount(tx, proposal.projectId);

    const [project] = await tx
      .select({ clientId: projects.clientId, title: projects.title })
      .from(projects)
      .where(eq(projects.id, proposal.projectId))
      .limit(1);

    if (project) {
      await notify(tx, {
        userId: project.clientId,
        type: "PROPOSAL_WITHDRAWN",
        title: `A proposal was withdrawn for “${project.title}”`,
        link: `/dashboard/projects/${proposal.projectId}`,
      });
    }

    return updated as Proposal;
  });
}

/** Load a proposal and prove the caller owns the project it belongs to. */
async function loadProposalForClient(
  tx: Tx,
  proposalId: string,
  clientId: string,
): Promise<{ proposal: Proposal; project: { id: string; title: string } }> {
  const rows = await tx
    .select({
      proposal: proposals,
      projectId: projects.id,
      title: projects.title,
      clientId: projects.clientId,
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .where(eq(proposals.id, proposalId))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound("Proposal not found.");
  if (row.clientId !== clientId) throw ApiError.forbidden("You do not own this project.");

  return { proposal: row.proposal, project: { id: row.projectId, title: row.title } };
}

export { loadProposalForClient as _loadProposalForClient };

/** Count of pending proposals — used on dashboards. */
export async function countIncomingProposals(clientId: string): Promise<number> {
  const database = await getDb();
  const [row] = await database
    .select({ value: sql<number>`count(*)::int` })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .where(and(eq(projects.clientId, clientId), eq(proposals.status, "PENDING")));
  return row?.value ?? 0;
}

/** Guard reused by the contract service. */
export async function assertProposalOpenForHire(
  tx: Tx,
  proposalId: string,
): Promise<{ proposal: Proposal; project: { id: string; title: string; clientId: string } }> {
  const rows = await tx
    .select({
      proposal: proposals,
      projectId: projects.id,
      title: projects.title,
      clientId: projects.clientId,
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .where(eq(proposals.id, proposalId))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound("Proposal not found.");
  if (!["PENDING", "SHORTLISTED"].includes(row.proposal.status)) {
    throw ApiError.conflict("Only pending or shortlisted proposals can be hired.");
  }

  const [existing] = await tx
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.projectId, row.projectId), ne(contracts.status, "CANCELLED")))
    .limit(1);
  if (existing) throw ApiError.conflict("This project already has a contract.");

  return {
    proposal: row.proposal,
    project: { id: row.projectId, title: row.title, clientId: row.clientId },
  };
}

/** Start (or reuse) the client↔freelancer conversation for a proposal. */
export async function openProposalThread(
  initiatorId: string,
  proposalId: string,
  body: string,
): Promise<{ threadId: string }> {
  const database = await getDb();

  return database.transaction(async (tx) => {
    const rows = await tx
      .select({
        proposalId: proposals.id,
        freelancerId: proposals.freelancerId,
        clientId: projects.clientId,
        title: projects.title,
        projectId: projects.id,
      })
      .from(proposals)
      .innerJoin(projects, eq(projects.id, proposals.projectId))
      .where(eq(proposals.id, proposalId))
      .limit(1);

    const row = rows[0];
    if (!row) throw ApiError.notFound("Proposal not found.");

    const participants = [row.clientId, row.freelancerId];
    if (!participants.includes(initiatorId)) {
      throw ApiError.forbidden("You are not part of this proposal.");
    }

    const other = row.clientId === initiatorId ? row.freelancerId : row.clientId;
    const thread = await getOrCreateThread(tx, {
      participantAId: initiatorId,
      participantBId: other,
      subject: `Proposal · ${row.title}`,
      proposalId: row.proposalId,
      projectId: row.projectId,
    });

    await sendMessage(tx, { threadId: thread.id, senderId: initiatorId, body });
    return { threadId: thread.id };
  });
}

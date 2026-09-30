import { and, desc, eq, inArray, ilike, or, sql } from "drizzle-orm";
import { db as getDb } from "@/lib/db";
import {
  auditLogs,
  categories,
  contracts,
  disputes,
  payouts,
  projects,
  skills,
  transactions,
  users,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";
import { slugify } from "@/lib/utils";
import type { AdminUserQuery, CreateCategoryInput, CreateSkillInput } from "@/lib/validation";

export interface PlatformStats {
  users: { total: number; clients: number; freelancers: number; admins: number; suspended: number };
  projects: { total: number; open: number; inProgress: number; closed: number };
  contracts: { total: number; active: number; completed: number; disputed: number };
  money: {
    inEscrowCents: number;
    releasedToFreelancersCents: number;
    platformFeesCents: number;
    grossVolumeCents: number;
    pendingPayoutCents: number;
  };
  disputes: { open: number; resolved: number };
}

/** Headline numbers for the admin dashboard. */
export async function platformStats(): Promise<PlatformStats> {
  const database = await getDb();

  const [userRows, projectRows, contractRows, moneyRows, disputeRows, payoutRows] =
    await Promise.all([
      database
        .select({
          role: users.role,
          status: users.status,
          value: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.role, users.status),
      database
        .select({ status: projects.status, value: sql<number>`count(*)::int` })
        .from(projects)
        .groupBy(projects.status),
      database
        .select({ status: contracts.status, value: sql<number>`count(*)::int` })
        .from(contracts)
        .groupBy(contracts.status),
      database
        .select({
          type: transactions.type,
          value: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::bigint`,
        })
        .from(transactions)
        .groupBy(transactions.type),
      database
        .select({ status: disputes.status, value: sql<number>`count(*)::int` })
        .from(disputes)
        .groupBy(disputes.status),
      database
        .select({ value: sql<number>`coalesce(sum(${payouts.amountCents}), 0)::bigint` })
        .from(payouts)
        .where(inArray(payouts.status, ["REQUESTED", "PROCESSING"])),
    ]);

  const sumWhere = (rows: Array<{ status: string; value: number }>, statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((t, r) => t + r.value, 0);

  const money = (type: string) => Number(moneyRows.find((r) => r.type === type)?.value ?? 0);

  const released = money("ESCROW_RELEASE");
  const fees = money("PLATFORM_FEE");

  return {
    users: {
      total: userRows.reduce((t, r) => t + r.value, 0),
      clients: userRows.filter((r) => r.role === "CLIENT").reduce((t, r) => t + r.value, 0),
      freelancers: userRows.filter((r) => r.role === "FREELANCER").reduce((t, r) => t + r.value, 0),
      admins: userRows.filter((r) => r.role === "ADMIN").reduce((t, r) => t + r.value, 0),
      suspended: userRows.filter((r) => r.status === "SUSPENDED").reduce((t, r) => t + r.value, 0),
    },
    projects: {
      total: projectRows.reduce((t, r) => t + r.value, 0),
      open: sumWhere(projectRows, ["OPEN"]),
      inProgress: sumWhere(projectRows, ["IN_PROGRESS"]),
      closed: sumWhere(projectRows, ["CLOSED"]),
    },
    contracts: {
      total: contractRows.reduce((t, r) => t + r.value, 0),
      active: sumWhere(contractRows, ["ACTIVE"]),
      completed: sumWhere(contractRows, ["COMPLETED"]),
      disputed: sumWhere(contractRows, ["DISPUTED"]),
    },
    money: {
      // Money currently locked: deposits minus everything that LEFT escrow:
      // freelancer payouts (net) + platform fees + refunds. (= released gross).
      inEscrowCents: money("ESCROW_DEPOSIT") - released - fees - money("REFUND"),
      releasedToFreelancersCents: released,
      platformFeesCents: fees,
      grossVolumeCents: released + fees,
      pendingPayoutCents: Number(payoutRows[0]?.value ?? 0),
    },
    disputes: {
      open: sumWhere(disputeRows, ["OPEN", "IN_REVIEW"]),
      resolved: sumWhere(disputeRows, ["RESOLVED_CLIENT", "RESOLVED_FREELANCER", "WITHDRAWN"]),
    },
  };
}

/** Paginated user directory for moderation. */
export async function listUsers(query: AdminUserQuery) {
  const database = await getDb();
  const conditions = [];
  if (query.role) conditions.push(eq(users.role, query.role));
  if (query.status) conditions.push(eq(users.status, query.status));
  if (query.q) {
    const pattern = `%${query.q}%`;
    const q = or(ilike(users.name, pattern), ilike(users.email, pattern));
    if (q) conditions.push(q);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalRow] = await Promise.all([
    database
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    database
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);

  return { items, total: totalRow[0]?.value ?? 0, page: query.page, pageSize: query.pageSize };
}

/** Disputes awaiting (or past) an admin decision. */
export async function listDisputes(filter: { status?: string } = {}) {
  const database = await getDb();
  const where = filter.status
    ? eq(disputes.status, filter.status as (typeof disputes.status.enumValues)[number])
    : undefined;

  return database
    .select({
      dispute: disputes,
      contractTitle: contracts.title,
      contractId: contracts.id,
      openerName: users.name,
      clientId: contracts.clientId,
      freelancerId: contracts.freelancerId,
    })
    .from(disputes)
    .innerJoin(contracts, eq(contracts.id, disputes.contractId))
    .innerJoin(users, eq(users.id, disputes.openedBy))
    .where(where)
    .orderBy(desc(disputes.createdAt));
}

/** Payouts waiting on finance. */
export async function listPendingPayouts() {
  const database = await getDb();
  return database
    .select({
      payout: payouts,
      freelancerName: users.name,
    })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.freelancerId))
    .where(inArray(payouts.status, ["REQUESTED", "PROCESSING"]))
    .orderBy(payouts.requestedAt);
}

export async function createCategory(input: CreateCategoryInput) {
  const database = await getDb();
  const [row] = await database
    .insert(categories)
    .values({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? null,
    })
    .onConflictDoUpdate({ target: categories.slug, set: { name: input.name } })
    .returning();
  return row;
}

export async function createSkill(input: CreateSkillInput) {
  const database = await getDb();
  const [row] = await database
    .insert(skills)
    .values({
      name: input.name,
      slug: slugify(input.name),
      categoryId: input.categoryId ?? null,
    })
    .onConflictDoUpdate({ target: skills.slug, set: { name: input.name } })
    .returning();
  return row;
}

/** Append an immutable audit entry for a privileged action. */
export async function writeAuditLog(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  const database = await getDb();
  await database.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}

export async function recentAuditLogs(limit = 50) {
  const database = await getDb();
  return database.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

/** Guard reused by every admin route. */
export function assertAdminRole(role: string): void {
  if (role !== "ADMIN") throw ApiError.forbidden("Administrator access required.");
}

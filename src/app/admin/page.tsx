import Link from "next/link";
import { platformStats, recentAuditLogs } from "@/server/services/admin.service";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PageHeader, Stat, Card, CardHeader, StatusBadge, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin console" };

export default async function AdminDashboardPage() {
  const [stats, audit] = await Promise.all([platformStats(), recentAuditLogs(20)]);

  return (
    <>
      <PageHeader
        eyebrow="Admin console"
        title="Platform health"
        actions={
          <div className="flex gap-2">
            <Link href="/admin/users" className="btn-secondary btn-sm">
              Users
            </Link>
            <Link href="/admin/disputes" className="btn-danger btn-sm">
              Disputes ({stats.disputes.open})
            </Link>
            <Link href="/admin/payouts" className="btn-secondary btn-sm">
              Payouts
            </Link>
          </div>
        }
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Money</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Gross volume"
          value={formatMoney(stats.money.grossVolumeCents)}
          hint="All escrow released"
        />
        <Stat
          label="In escrow now"
          value={formatMoney(stats.money.inEscrowCents)}
          hint="Deposits − releases − refunds"
        />
        <Stat
          label="Platform revenue"
          value={formatMoney(stats.money.platformFeesCents)}
          hint="10% of released"
        />
        <Stat
          label="Paid to freelancers"
          value={formatMoney(stats.money.releasedToFreelancersCents)}
        />
        <Stat label="Pending payouts" value={formatMoney(stats.money.pendingPayoutCents)} />
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Marketplace
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat
          label="Users"
          value={String(stats.users.total)}
          hint={`${stats.users.suspended} suspended`}
        />
        <Stat label="Clients" value={String(stats.users.clients)} />
        <Stat label="Freelancers" value={String(stats.users.freelancers)} />
        <Stat
          label="Open projects"
          value={String(stats.projects.open)}
          hint={`${stats.projects.total} total`}
        />
        <Stat
          label="Active contracts"
          value={String(stats.contracts.active)}
          hint={`${stats.contracts.completed} completed`}
        />
        <Stat
          label="Disputes open"
          value={String(stats.disputes.open)}
          hint={`${stats.disputes.resolved} resolved`}
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Needs attention" />
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-ink-700">Open disputes awaiting review</span>
              <Badge tone={stats.disputes.open > 0 ? "rose" : "green"}>{stats.disputes.open}</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-700">Payouts waiting on finance</span>
              <Badge tone={stats.money.pendingPayoutCents > 0 ? "amber" : "green"}>
                {formatMoney(stats.money.pendingPayoutCents)}
              </Badge>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-700">Suspended accounts</span>
              <Badge tone={stats.users.suspended > 0 ? "amber" : "gray"}>
                {stats.users.suspended}
              </Badge>
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Recent admin actions"
            description="Audit trail — every privileged change is logged."
          />
          {audit.length === 0 ? (
            <p className="text-sm text-ink-500">No admin actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-800">
                    <span className="font-mono text-xs text-brand-700">{entry.action}</span> on{" "}
                    {entry.entityType} {entry.entityId ? `· ${entry.entityId.slice(0, 8)}` : ""}
                  </span>
                  <span className="text-xs text-ink-400">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-8 text-xs text-ink-400">
        Contract statuses:{" "}
        {["ACTIVE", "COMPLETED", "DISPUTED", "CANCELLED"].map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </p>
    </>
  );
}

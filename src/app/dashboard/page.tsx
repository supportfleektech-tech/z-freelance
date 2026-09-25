import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { listClientProjects } from "@/server/services/project.service";
import {
  countIncomingProposals,
  listFreelancerProposals,
} from "@/server/services/proposal.service";
import { listContractsForUser, getWallet } from "@/server/services/contract.service";
import { getProfileBundle } from "@/server/services/account.service";
import { listNotifications } from "@/server/services/notification.service";
import { db as getDb } from "@/lib/db";
import { formatMoney, formatBudget } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PageHeader, Stat, Card, CardHeader, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  return user.role === "FREELANCER" ? (
    <FreelancerHome userId={user.id} />
  ) : (
    <ClientHome userId={user.id} />
  );
}

/* ---------------------------------------------------------------- client */

async function ClientHome({ userId }: { userId: string }) {
  const [projects, pending, contracts, bundle, feed] = await Promise.all([
    listClientProjects(userId),
    countIncomingProposals(userId),
    listContractsForUser(userId),
    getProfileBundle(userId),
    listNotifications(await getDb(), userId, { pageSize: 5 }),
  ]);

  const open = projects.filter((p) => p.status === "OPEN").length;
  const activeContracts = contracts.filter((c) => c.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        eyebrow="Client workspace"
        title={`Welcome back, ${bundle?.user.name.split(" ")[0] ?? "there"}`}
        actions={
          <Link href="/dashboard/projects/new" className="btn-primary">
            Post a project
            <ArrowRight size={16} />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open projects" value={String(open)} hint={`${projects.length} total`} />
        <Stat label="Pending proposals" value={String(pending)} hint="Waiting for your review" />
        <Stat label="Active contracts" value={String(activeContracts)} />
        <Stat
          label="Total spent"
          value={formatMoney(Number(bundle?.client?.totalSpentCents ?? 0))}
        />
      </div>

      {pending > 0 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>
            {pending} proposal{pending === 1 ? "" : "s"}
          </strong>{" "}
          waiting for a decision — specialists move fast, so review them soon.{" "}
          <Link href="/dashboard/projects" className="link">
            Review now →
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Recent projects"
            actions={
              <Link href="/dashboard/projects" className="link text-sm">
                View all
              </Link>
            }
          />
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Post your first project and proposals will start arriving within hours."
              action={
                <Link href="/dashboard/projects/new" className="btn-primary btn-sm">
                  Post a project
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {projects.slice(0, 5).map((project) => (
                <li key={project.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="block truncate font-medium text-ink-900 hover:text-brand-700"
                    >
                      {project.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {project.proposalsCount} proposals · posted {timeAgo(project.publishedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-sm font-semibold tabular-nums text-ink-900 sm:block">
                      {formatBudget(
                        project.budgetMinCents,
                        project.budgetMaxCents,
                        project.budgetType,
                      )}
                    </span>
                    <StatusBadge status={project.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest activity" />
          <ul className="space-y-3">
            {feed.items.length === 0 ? (
              <li className="text-sm text-ink-500">Nothing yet — post a project to get started.</li>
            ) : (
              feed.items.map((n) => (
                <li key={n.id} className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-medium text-ink-800">{n.title}</p>
                  <p className="text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ freelancer */

async function FreelancerHome({ userId }: { userId: string }) {
  const [proposals, contracts, wallet, bundle, feed] = await Promise.all([
    listFreelancerProposals(userId),
    listContractsForUser(userId),
    getWallet(userId).catch(() => null),
    getProfileBundle(userId),
    listNotifications(await getDb(), userId, { pageSize: 5 }),
  ]);

  const pending = proposals.filter((p) =>
    ["PENDING", "SHORTLISTED"].includes(p.proposal.status),
  ).length;
  const active = contracts.filter((c) => c.status === "ACTIVE").length;
  const earned = Number(bundle?.freelancer?.totalEarnedCents ?? 0);
  const rating = bundle?.freelancer?.ratingAvg ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Freelancer workspace"
        title={`Welcome back, ${bundle?.user.name.split(" ")[0] ?? "there"}`}
        actions={
          <Link href="/projects" className="btn-primary">
            Find work
            <ArrowRight size={16} />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Wallet balance"
          value={formatMoney(wallet?.balanceCents ?? 0)}
          hint="Available to withdraw"
        />
        <Stat label="Open proposals" value={String(pending)} hint={`${proposals.length} total`} />
        <Stat label="Active contracts" value={String(active)} />
        <Stat
          label="Lifetime earned"
          value={formatMoney(earned)}
          hint={rating > 0 ? `★ ${rating.toFixed(1)} rating` : undefined}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Recent proposals"
            actions={
              <Link href="/dashboard/proposals" className="link text-sm">
                View all
              </Link>
            }
          />
          {proposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              description="Browse the marketplace and bid on projects that match your skills."
              action={
                <Link href="/projects" className="btn-primary btn-sm">
                  Browse projects
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {proposals.slice(0, 5).map(({ proposal, projectTitle, projectId }) => (
                <li key={proposal.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${projectId}`}
                      className="block truncate font-medium text-ink-900 hover:text-brand-700"
                    >
                      {projectTitle}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Your bid {formatMoney(proposal.bidAmountCents)} ·{" "}
                      {timeAgo(proposal.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={proposal.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest activity" />
          <ul className="space-y-3">
            {feed.items.length === 0 ? (
              <li className="text-sm text-ink-500">
                Nothing yet — submit a proposal to get started.
              </li>
            ) : (
              feed.items.map((n) => (
                <li key={n.id} className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-medium text-ink-800">{n.title}</p>
                  <p className="text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { listFreelancerProposals } from "@/server/services/proposal.service";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState, Card } from "@/components/ui";
import { WithdrawButton } from "@/components/withdraw-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "My proposals" };

export default async function MyProposalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/proposals");
  if (user.role === "CLIENT") redirect("/dashboard/projects");

  const rows = await listFreelancerProposals(user.id);

  return (
    <>
      <PageHeader
        title="My proposals"
        description="Track every bid: pending, shortlisted, hired — and withdraw while it's still open."
        actions={
          <Link href="/projects" className="btn-primary">
            Find more work
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No proposals yet"
          description="Browse the marketplace and submit your first proposal. A thoughtful cover letter wins work."
          action={
            <Link href="/projects" className="btn-primary btn-sm">
              Browse projects
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink-100">
            {rows.map(
              ({
                proposal,
                projectTitle,
                projectId,
                projectStatus,
                budgetType,
                budgetMinCents,
                budgetMaxCents,
                clientName,
              }) => (
                <li key={proposal.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${projectId}`}
                        className="font-semibold text-ink-900 hover:text-brand-700"
                      >
                        {projectTitle}
                      </Link>
                      <p className="mt-1 text-xs text-ink-500">
                        by {clientName} · project {projectStatus.toLowerCase().replace("_", " ")} ·{" "}
                        {budgetMinCents || budgetMaxCents
                          ? `budget ${formatMoney(budgetMinCents ?? 0)}${budgetMaxCents && budgetMaxCents !== budgetMinCents ? ` – ${formatMoney(budgetMaxCents)}` : ""}${budgetType === "HOURLY" ? "/hr" : ""}`
                          : "budget undisclosed"}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-ink-600">
                        {proposal.coverLetter}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={proposal.status} />
                      <p className="mt-1 text-sm font-bold tabular-nums text-ink-950">
                        {formatMoney(proposal.bidAmountCents)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {proposal.estimatedDays} days · {timeAgo(proposal.createdAt)}
                      </p>
                    </div>
                  </div>
                  {["PENDING", "SHORTLISTED"].includes(proposal.status) ? (
                    <div className="mt-3">
                      <WithdrawButton proposalId={proposal.id} />
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </Card>
      )}
    </>
  );
}

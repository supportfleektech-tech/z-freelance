import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProjectDetail } from "@/server/services/project.service";
import { listProposalsForProject } from "@/server/services/proposal.service";
import { listContractsForUser } from "@/server/services/contract.service";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import {
  PageHeader,
  StatusBadge,
  Stars,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Avatar,
} from "@/components/ui";
import { ProposalActions } from "@/components/proposal-actions";
import { ProjectTransitionButton } from "@/components/project-transition-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposals" };

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "FREELANCER") redirect("/dashboard/proposals");

  const { id } = await params;
  const project = await getProjectDetail(id, { viewerId: user.id });
  if (!project) notFound();
  if (project.clientId !== user.id) redirect("/dashboard/projects");

  const [proposals, contracts] = await Promise.all([
    listProposalsForProject(id),
    listContractsForUser(user.id),
  ]);
  const contract = contracts.find((c) => c.projectId === id);

  const openProposals = proposals.filter((p) => ["PENDING", "SHORTLISTED"].includes(p.status));
  const decidedProposals = proposals.filter(
    (p) => !["PENDING", "SHORTLISTED"].includes(p.status) && p.status !== "HIRED",
  );
  const hired = proposals.find((p) => p.status === "HIRED");

  return (
    <>
      <PageHeader
        eyebrow="Project workspace"
        title={project.title}
        actions={
          <div className="flex gap-2">
            <StatusBadge status={project.status} />
            {project.status === "OPEN" || project.status === "IN_PROGRESS" ? (
              <ProjectTransitionButton projectId={id} action="CLOSE" label="Close project" />
            ) : null}
          </div>
        }
      />

      {contract ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            <strong>Hired {hired?.freelancerName ?? contract.counterpartyName}</strong> for{" "}
            {formatMoney(contract.amountCents)}.{" "}
            <Link href={`/dashboard/contracts/${contract.id}`} className="link">
              Open the escrow workspace →
            </Link>
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Open proposals (${openProposals.length})`}
              description={
                contract
                  ? undefined
                  : "Hiring creates a contract, rejects the others and opens a workspace thread."
              }
            />
            {openProposals.length === 0 ? (
              <EmptyState
                title={contract ? "No open proposals" : "No proposals yet"}
                description={
                  contract
                    ? undefined
                    : "Share the project link to attract specialists. Completed profiles and realistic budgets get responses fastest."
                }
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {openProposals.map((proposal) => (
                  <li key={proposal.id} className="py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={proposal.freelancerName} id={proposal.freelancerId} />
                        <div>
                          <p className="font-semibold text-ink-900">{proposal.freelancerName}</p>
                          <p className="text-xs text-ink-500">
                            {proposal.freelancerHeadline ?? "Independent specialist"}
                          </p>
                          <Stars
                            rating={proposal.freelancerRating}
                            count={proposal.freelancerRatingCount}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-ink-950">
                          {formatMoney(proposal.bidAmountCents)}
                        </p>
                        <p className="text-xs text-ink-500">
                          {proposal.estimatedDays} days · {timeAgo(proposal.createdAt)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 p-4 text-sm leading-6 text-ink-700">
                      {proposal.coverLetter}
                    </p>

                    {proposal.freelancerSkills.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {proposal.freelancerSkills.map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    ) : null}

                    <ProposalActions
                      proposalId={proposal.id}
                      projectId={id}
                      status={proposal.status}
                      canHire={!contract && project.status === "OPEN"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {decidedProposals.length > 0 ? (
            <Card>
              <CardHeader title={`Earlier decisions (${decidedProposals.length})`} />
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Freelancer</th>
                    <th>Bid</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {decidedProposals.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.freelancerName}</td>
                      <td className="tabular-nums">{formatMoney(p.bidAmountCents)}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Your brief"
            actions={
              <Link href={`/projects/${id}`} className="link text-sm">
                Public view
              </Link>
            }
          />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-ink-500">Budget</dt>
              <dd className="font-semibold text-ink-900">
                {formatMoney(project.budgetMinCents ?? 0)}
                {project.budgetMaxCents && project.budgetMaxCents !== project.budgetMinCents
                  ? ` – ${formatMoney(project.budgetMaxCents)}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-ink-500">Level</dt>
              <dd>
                <StatusBadge status={project.experienceLevel} />
              </dd>
            </div>
            {project.skillNames.length > 0 ? (
              <div>
                <dt className="mb-1 text-xs font-medium uppercase text-ink-500">Skills</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {project.skillNames.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          {project.status === "DRAFT" ? (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <ProjectTransitionButton
                projectId={id}
                action="PUBLISH"
                label="Publish project"
                primary
              />
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

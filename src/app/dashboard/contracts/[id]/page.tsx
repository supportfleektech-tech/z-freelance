import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getContractDetail } from "@/server/services/contract.service";
import { ratingSummary } from "@/server/services/review.service";
import { db as getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, humanize, timeAgo } from "@/lib/utils";
import {
  PageHeader,
  StatusBadge,
  Card,
  CardHeader,
  Stat,
  EmptyState,
  Alert,
  Stars,
  Avatar,
} from "@/components/ui";
import { MilestoneActions } from "@/components/milestone-actions";
import { MilestonePlanForm } from "@/components/milestone-plan-form";
import { DisputeForm } from "@/components/dispute-form";
import { CancelContractButton } from "@/components/cancel-contract-button";
import { ReviewForm } from "@/components/review-form";
import { StartThreadButton } from "@/components/thread-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract workspace" };

export default async function ContractWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [detail] = await Promise.all([getContractDetail(id, user.id).catch(() => null)]);
  if (!detail) notFound();

  const isClient = detail.contract.clientId === user.id;
  const { contract, milestones, ledger, disputes, totals } = detail;

  const counterparty = isClient ? detail.freelancer : detail.client;
  const counterpartyHeadline = isClient ? detail.freelancer.headline : null;
  const isClientViewer = isClient;

  // If completed, has this viewer already left a review?
  let alreadyReviewed = false;
  if (contract.status === "COMPLETED") {
    const database = await getDb();
    const rows = await database
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.contractId, contract.id), eq(schema.reviews.authorId, user.id)))
      .limit(1);
    alreadyReviewed = rows.length > 0;
  }
  const counterpartyRating = await ratingSummary(counterparty.id);

  return (
    <>
      <PageHeader
        eyebrow="Contract workspace"
        title={contract.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={contract.status} />
            <StartThreadButton
              contractId={contract.id}
              label={`Message ${counterparty.name.split(" ")[0]}`}
            />
          </div>
        }
      />

      {/* ------------------------------------------------ live escrow numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Contract value"
          value={formatMoney(totals.amountCents)}
          hint={`Platform fee ${contract.platformFeeBps / 100}%`}
        />
        <Stat
          label="In escrow now"
          value={formatMoney(
            milestones
              .filter((m) => ["FUNDED", "SUBMITTED", "DISPUTED"].includes(m.status))
              .reduce((t, m) => t + m.amountCents, 0),
          )}
          hint="Locked until approved or resolved"
        />
        <Stat
          label="Released"
          value={formatMoney(totals.releasedCents)}
          hint={
            isClientViewer
              ? `Fee paid: ${formatMoney(totals.feeCents)}`
              : `Fee deducted: ${formatMoney(totals.feeCents)}`
          }
        />
        <Stat
          label={isClientViewer ? "Unallocated" : "You net"}
          value={formatMoney(isClientViewer ? totals.remainingCents : totals.freelancerNetCents)}
          hint={isClientViewer ? "Not yet planned as milestones" : "Net of platform fee"}
        />
      </div>

      {contract.status === "DISPUTED" ? (
        <div className="mt-6">
          <Alert tone="error">
            <strong>This contract is disputed.</strong> Funds stay in escrow while an administrator
            reviews. Keep communication inside the workspace — it forms part of the record.
          </Alert>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* ---------------------------------------------------- milestones */}
          <Card>
            <CardHeader
              title={`Milestones (${milestones.length})`}
              description={`Planned ${formatMoney(totals.plannedCents)} of ${formatMoney(totals.amountCents)} contract value`}
            />

            {milestones.length === 0 ? (
              <EmptyState
                title="No milestones yet"
                description={
                  isClient
                    ? "Split the work into milestones. Each one must be funded individually before work starts."
                    : "The client defines the milestones. Message them to agree the plan."
                }
              />
            ) : (
              <ol className="space-y-4">
                {milestones.map((m) => (
                  <li key={m.id} className="rounded-xl border border-ink-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ink-400">#{m.position}</span>
                          <h3 className="font-semibold text-ink-900">{m.title}</h3>
                          <StatusBadge status={m.status} />
                        </div>
                        {m.description ? (
                          <p className="mt-1 text-sm text-ink-600">{m.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                          {m.dueDate ? <span>Due {formatDate(m.dueDate)}</span> : null}
                          {m.fundedAt ? <span>Funded {timeAgo(m.fundedAt)}</span> : null}
                          {m.submittedAt ? <span>Delivered {timeAgo(m.submittedAt)}</span> : null}
                          {m.releasedAt ? <span>Released {timeAgo(m.releasedAt)}</span> : null}
                          {m.escrowReference ? (
                            <span className="font-mono">{m.escrowReference}</span>
                          ) : null}
                        </div>
                        {m.submissionNote ? (
                          <p className="mt-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
                            <span className="font-medium">Delivery note: </span>
                            {m.submissionNote}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-lg font-bold tabular-nums text-ink-950">
                        {formatMoney(m.amountCents)}
                      </p>
                    </div>

                    <MilestoneActions milestone={m} contract={contract} isClient={isClient} />
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* --------------------------------------------------- plan editor */}
          {isClient && contract.status === "ACTIVE" ? (
            <MilestonePlanForm
              contractId={contract.id}
              contractAmountCents={contract.amountCents}
              plannedCents={totals.plannedCents}
              hasFunded={milestones.some((m) => m.status !== "PENDING")}
            />
          ) : null}

          {/* --------------------------------------------------------- ledger */}
          <Card>
            <CardHeader
              title="Payment ledger"
              description="Every movement of money on this contract, in order."
            />
            {ledger.length === 0 ? (
              <p className="text-sm text-ink-500">No money has moved yet.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th className="hidden sm:table-cell">Reference</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <StatusBadge status={entry.type} />
                      </td>
                      <td className="tabular-nums">{formatMoney(entry.amountCents)}</td>
                      <td className="hidden font-mono text-xs text-ink-500 sm:table-cell">
                        {entry.reference ?? "—"}
                      </td>
                      <td className="text-ink-500">{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* ------------------------------------------------- counterparty */}
          <Card>
            <CardHeader title={isClient ? "Your freelancer" : "Your client"} />
            <div className="flex items-center gap-3">
              <Avatar name={counterparty.name} id={counterparty.id} />
              <div>
                <p className="font-semibold text-ink-900">{counterparty.name}</p>
                {counterpartyHeadline ? (
                  <p className="text-xs text-ink-500">{counterpartyHeadline}</p>
                ) : null}
                <Stars rating={counterpartyRating.average} count={counterpartyRating.count} />
              </div>
            </div>
          </Card>

          {/* ------------------------------------------------------- actions */}
          {["ACTIVE", "DISPUTED"].includes(contract.status) ? (
            <Card>
              <CardHeader
                title="Escalate"
                description="Optional: request admin review. Escrow stays locked while a dispute is open."
              />
              <DisputeForm
                contractId={contract.id}
                milestones={milestones.map((m) => ({ id: m.id, title: m.title, status: m.status }))}
              />
              {milestones.every((m) => m.status === "PENDING") && contract.status === "ACTIVE" ? (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <p className="mb-2 text-sm text-ink-600">
                    No money in escrow yet — either side can still walk away cleanly.
                  </p>
                  <CancelContractButton contractId={contract.id} />
                </div>
              ) : null}
            </Card>
          ) : null}

          {/* ------------------------------------------------------- disputes */}
          {disputes.length > 0 ? (
            <Card>
              <CardHeader title="Dispute history" />
              <ul className="space-y-3">
                {disputes.map((d) => (
                  <li key={d.id} className="rounded-lg bg-ink-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={d.status} />
                      <span className="text-xs text-ink-400">{timeAgo(d.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-ink-700">{d.reason}</p>
                    {d.resolutionNote ? (
                      <p className="mt-2 text-xs text-ink-500">Resolution: {d.resolutionNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* -------------------------------------------------------- review */}
          {contract.status === "COMPLETED" ? (
            alreadyReviewed ? (
              <Card>
                <Alert tone="success">Contract complete — thanks. Your review is posted.</Alert>
              </Card>
            ) : (
              <ReviewForm contractId={contract.id} subjectName={counterparty.name} />
            )
          ) : null}

          <Card>
            <p className="text-xs leading-5 text-ink-500">
              {humanize(contract.status)} · contract opened {formatDate(contract.startedAt)}
              {contract.completedAt ? `, completed ${formatDate(contract.completedAt)}` : ""}
              {contract.cancelledAt ? `, cancelled ${formatDate(contract.cancelledAt)}` : ""}.
            </p>
            <Link
              href={`/projects/${contract.projectId}`}
              className="link mt-2 inline-block text-sm"
            >
              View the original project →
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

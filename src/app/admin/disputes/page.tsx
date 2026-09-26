import Link from "next/link";
import { listDisputes } from "@/server/services/admin.service";
import { timeAgo } from "@/lib/utils";
import { PageHeader, StatusBadge, Card, EmptyState } from "@/components/ui";
import { ResolveDisputeForm } from "@/components/resolve-dispute-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes" };

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const disputes = await listDisputes({ status });
  const open = disputes.filter((d) => ["OPEN", "IN_REVIEW"].includes(d.dispute.status));

  return (
    <>
      <PageHeader
        title="Dispute queue"
        description="Resolving in the freelancer's favour releases escrow; in the client's favour refunds it. Escrow stays locked until you decide."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/disputes" className="btn-secondary btn-sm">
              All
            </Link>
            <Link href="/admin/disputes?status=OPEN" className="btn-secondary btn-sm">
              Open ({open.length})
            </Link>
          </div>
        }
      />

      {disputes.length === 0 ? (
        <EmptyState
          title="No disputes here"
          description="When two parties disagree on a delivery, their case lands here."
        />
      ) : (
        <div className="space-y-4">
          {disputes.map(({ dispute, contractTitle, contractId, openerName }) => (
            <Card key={dispute.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-ink-900">{contractTitle}</h2>
                    <StatusBadge status={dispute.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    opened by {openerName} · {timeAgo(dispute.createdAt)} ·{" "}
                    <Link href={`/dashboard/contracts/${contractId}`} className="link">
                      contract
                    </Link>
                  </p>
                </div>
                {dispute.milestoneId ? <StatusBadge status="FUNDED" /> : null}
              </div>

              <blockquote className="mt-3 rounded-lg bg-ink-50 p-4 text-sm text-ink-700">
                {dispute.reason}
              </blockquote>

              {dispute.resolutionNote ? (
                <p className="mt-3 text-sm text-ink-600">
                  <span className="font-medium">Resolution:</span> {dispute.resolutionNote}
                </p>
              ) : null}

              {["OPEN", "IN_REVIEW"].includes(dispute.status) ? (
                <ResolveDisputeForm disputeId={dispute.id} />
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

import { listPendingPayouts } from "@/server/services/admin.service";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, StatusBadge, Card, EmptyState } from "@/components/ui";
import { MarkPayoutPaidButton } from "@/components/mark-payout-paid-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

export default async function AdminPayoutsPage() {
  const rows = await listPendingPayouts();

  return (
    <>
      <PageHeader
        title="Payout queue"
        description="Withdrawal requests awaiting transfer. Marking one paid moves it out of the freelancer's pending balance."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to process"
          description="Freelancer withdrawal requests will appear here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Freelancer</th>
                <th>Amount</th>
                <th>Method</th>
                <th className="hidden sm:table-cell">Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ payout, freelancerName }) => (
                <tr key={payout.id}>
                  <td className="font-medium text-ink-900">{freelancerName}</td>
                  <td className="tabular-nums">{formatMoney(payout.amountCents)}</td>
                  <td>{payout.method}</td>
                  <td className="hidden text-ink-500 sm:table-cell">
                    {formatDateTime(payout.requestedAt)}
                  </td>
                  <td>
                    <StatusBadge status={payout.status} />
                  </td>
                  <td>
                    <MarkPayoutPaidButton payoutId={payout.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

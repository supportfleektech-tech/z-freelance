import { redirect } from "next/navigation";
import { LandMarkIconEmpty } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth/guards";
import { getWallet, listLedger, listPayouts } from "@/server/services/contract.service";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Stat, Card, CardHeader, StatusBadge, EmptyState } from "@/components/ui";
import { PayoutForm } from "@/components/payout-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/earnings");
  if (user.role === "CLIENT") redirect("/dashboard");

  const [wallet, ledger, payouts] = await Promise.all([
    getWallet(user.id),
    listLedger(user.id),
    listPayouts(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Money you've received through escrow, your withdrawal history, and the full ledger."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Available balance"
          value={formatMoney(wallet.balanceCents)}
          hint="Released escrow, net of fees"
        />
        <Stat
          label="Processing payouts"
          value={formatMoney(wallet.pendingCents)}
          hint="On the way to your bank"
        />
        <Stat label="Currency" value={wallet.currency} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Withdraw funds"
              description="Payouts are reviewed by our finance team and arrive in 1–3 business days."
            />
            {wallet.balanceCents > 0 ? (
              <PayoutForm balanceCents={wallet.balanceCents} />
            ) : (
              <p className="text-sm text-ink-500">Complete a milestone to unlock withdrawals.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Withdrawal history" />
            {payouts.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <LandMarkIconEmpty /> No withdrawals yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold tabular-nums text-ink-900">
                        {formatMoney(p.amountCents)}
                      </p>
                      <p className="text-xs text-ink-500">{formatDateTime(p.requestedAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Ledger" description="Every credit and debit on your account." />
          {ledger.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Your first escrow release will appear here."
            />
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
    </>
  );
}

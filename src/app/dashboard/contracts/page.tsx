import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { listContractsForUser } from "@/server/services/contract.service";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/contracts");

  const contracts = await listContractsForUser(user.id);

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Every contract here is backed by milestone escrow — the source of truth for money in motion."
      />

      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description={
            user.role === "CLIENT"
              ? "Hire a freelancer from your project proposals and the contract appears here."
              : "Contracts appear the moment a client hires one of your proposals."
          }
          action={
            user.role === "CLIENT" ? (
              <Link href="/dashboard/projects" className="btn-primary btn-sm">
                View my projects
              </Link>
            ) : (
              <Link href="/projects" className="btn-primary btn-sm">
                Find work
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/dashboard/contracts/${contract.id}`}
              className="card grid gap-4 p-5 hover:border-brand-300 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ink-900">{contract.title}</h2>
                  <StatusBadge status={contract.status} />
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  with {contract.counterpartyName} · started {formatDate(contract.startedAt)} ·{" "}
                  {contract.milestoneCount} milestones
                  {contract.openMilestoneCount > 0 ? ` (${contract.openMilestoneCount} open)` : ""}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-bold tabular-nums text-ink-950">
                  {formatMoney(contract.amountCents)}
                </p>
                <p className="text-xs text-ink-500">
                  {formatMoney(contract.releasedCents)} released
                </p>
              </div>
              <Progress value={contract.releasedCents} max={Math.max(1, contract.amountCents)} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="sm:col-span-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

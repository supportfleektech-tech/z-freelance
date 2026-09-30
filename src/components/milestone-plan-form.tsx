"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert, Card, CardHeader } from "./ui";

interface Draft {
  title: string;
  description: string;
  amount: string;
  dueDate: string;
}

const emptyDraft = (): Draft => ({ title: "", description: "", amount: "", dueDate: "" });

/**
 * Client-side milestone planner.
 *
 * Adds milestones one at a time. The API enforces that the plan never exceeds
 * the contract value; the UI gives the same feedback live.
 */
export function MilestonePlanForm(props: {
  contractId: string;
  contractAmountCents: number;
  plannedCents: number;
  hasFunded: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const remainingCents = props.contractAmountCents - props.plannedCents;
  const draftCents = Math.max(0, Math.round(Number.parseFloat(draft.amount || "0") * 100));
  const wouldExceed = draftCents > remainingCents;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/contracts/${props.contractId}/milestones`, {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || undefined,
          amountCents: draftCents,
          dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : undefined,
        }),
      });
      setDraft(emptyDraft());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the milestone.");
      setPending(false);
    }
  }

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Card>
      <CardHeader
        title="Add a milestone"
        description={`${fmt(remainingCents)} of the contract value remains unallocated.`}
      />
      {props.hasFunded ? (
        <Alert tone="info">
          A milestone is already funded, so the existing plan can grow but not be replaced.
        </Alert>
      ) : null}

      <form onSubmit={add} className="mt-4 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_140px_140px]">
          <div>
            <label className="label" htmlFor="mTitle">
              Title
            </label>
            <input
              id="mTitle"
              className="input"
              placeholder="e.g. Design mockups approved"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="label" htmlFor="mAmount">
              Amount (USD)
            </label>
            <input
              id="mAmount"
              type="number"
              min="0.01"
              step="0.01"
              className={`input ${wouldExceed ? "border-rose-400" : ""}`}
              placeholder="4,000"
              required
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
            <p className={`mt-1 text-xs ${wouldExceed ? "text-rose-600" : "text-ink-400"}`}>
              {wouldExceed ? "Exceeds the unallocated balance" : `${fmt(remainingCents)} available`}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="mDue">
              Due date
            </label>
            <input
              id="mDue"
              type="date"
              className="input"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mDesc">
            Description (optional)
          </label>
          <textarea
            id="mDesc"
            className="input min-h-20"
            placeholder="What specifically will be delivered for this payment?"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="btn-secondary btn-sm"
          disabled={pending || wouldExceed || draftCents <= 0}
        >
          <Plus size={14} />
          {pending ? "Adding…" : "Add milestone"}
        </button>
      </form>
    </Card>
  );
}

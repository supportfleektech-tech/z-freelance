"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

/** Opens a dispute, either on the contract or a specific funded milestone. */
export function DisputeForm(props: {
  contractId: string;
  milestones: Array<{ id: string; title: string; status: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [milestoneId, setMilestoneId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const disputable = props.milestones.filter((m) => ["FUNDED", "SUBMITTED"].includes(m.status));

  if (props.milestones.length === 0) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/contracts/${props.contractId}/disputes`, {
        method: "POST",
        body: JSON.stringify({ milestoneId: milestoneId || undefined, reason }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the dispute.");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm w-full" onClick={() => setOpen(true)}>
        <Scale size={14} />
        Open a dispute
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {disputable.length > 0 ? (
        <div>
          <label className="label" htmlFor="disputeMilestone">
            Scope
          </label>
          <select
            id="disputeMilestone"
            className="input"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">The whole contract</option>
            {disputable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.status.toLowerCase()})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="disputeReason">
          What happened?
        </label>
        <textarea
          id="disputeReason"
          className="input min-h-28"
          placeholder="Explain the situation factually. An administrator reads this, along with the contract's messages and ledger."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={20}
          maxLength={2000}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-danger btn-sm" disabled={pending}>
          {pending ? "Opening…" : "Open dispute"}
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-ink-500">
        Escrow stays locked while the dispute is open. Both parties are notified.
      </p>
    </form>
  );
}

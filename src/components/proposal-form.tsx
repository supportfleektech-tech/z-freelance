"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

/**
 * Freelancer bid form. Amounts are entered as dollars in the UI and converted
 * to cents before touching the API — the API never sees a float.
 */
export function ProposalForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState("");
  const [bid, setBid] = useState("");
  const [days, setDays] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cents = Math.max(0, Math.round(Number.parseFloat(bid || "0") * 100));
  const fee = Math.floor(cents * 0.1);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          coverLetter,
          bidAmountCents: cents,
          estimatedDays: Number.parseInt(days, 10) || 14,
        }),
      });
      router.push("/dashboard/proposals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the proposal.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div>
        <label htmlFor="coverLetter" className="label">
          Cover letter
        </label>
        <textarea
          id="coverLetter"
          className="input min-h-32"
          placeholder="How you'd approach this project, what you'd deliver first, and why you're the right specialist…"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          required
          minLength={80}
          maxLength={4000}
        />
        <p className="mt-1 text-xs text-ink-400">
          {coverLetter.length}/4000 · minimum 80 characters
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bid" className="label">
            Total bid (USD)
          </label>
          <input
            id="bid"
            type="number"
            min="5"
            step="0.01"
            className="input"
            placeholder="10,500"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="days" className="label">
            Delivery (days)
          </label>
          <input
            id="days"
            type="number"
            min="1"
            max="365"
            className="input"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
        </div>
      </div>

      {cents > 0 ? (
        <div className="rounded-lg bg-ink-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-600">Your bid</span>
            <span className="font-semibold tabular-nums">${(cents / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-ink-600">Platform fee (10%)</span>
            <span className="tabular-nums text-ink-500">−${(fee / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-ink-200 pt-1">
            <span className="font-medium text-ink-900">You receive</span>
            <span className="font-bold tabular-nums text-emerald-700">
              ${((cents - fee) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit proposal"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

/** Admin decision form: release the escrow to the freelancer or refund the client. */
export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function resolve(outcome: "RESOLVED_CLIENT" | "RESOLVED_FREELANCER") {
    const action =
      outcome === "RESOLVED_FREELANCER" ? "release escrow to the freelancer" : "refund the client";
    if (!window.confirm(`Confirm: ${action}? This moves real money and cannot be undone.`)) return;

    setError(null);
    setPending(outcome);
    try {
      await fetchJson(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ outcome, resolutionNote: note || "Resolved by platform review." }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolution failed.");
      setPending(null);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <textarea
        className="input min-h-20"
        placeholder="Write the resolution rationale — both parties see this."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        minLength={10}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-success btn-sm"
          disabled={pending != null}
          onClick={() => void resolve("RESOLVED_FREELANCER")}
        >
          {pending === "RESOLVED_FREELANCER" ? "Releasing…" : "Release escrow to freelancer"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={pending != null}
          onClick={() => void resolve("RESOLVED_CLIENT")}
        >
          {pending === "RESOLVED_CLIENT" ? "Refunding…" : "Refund client"}
        </button>
      </div>
    </div>
  );
}

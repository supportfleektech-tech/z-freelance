"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

export function CancelContractButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    const reason = window.prompt("Why are you cancelling? (shared with the other party)");
    if (reason == null) return;
    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/contracts/${contractId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || "Contract cancelled by mutual decision." }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        className="btn-danger btn-sm"
        onClick={() => void cancel()}
        disabled={pending}
      >
        {pending ? "Cancelling…" : "Cancel contract"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

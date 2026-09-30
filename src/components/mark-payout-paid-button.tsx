"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

export function MarkPayoutPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    if (!window.confirm("Confirm the transfer has been sent to the freelancer?")) return;
    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/admin/payouts/${payoutId}/pay`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this payout paid.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-success btn-sm"
        disabled={pending}
        onClick={() => void markPaid()}
      >
        {pending ? "Saving…" : "Mark paid"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

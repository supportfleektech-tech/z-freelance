"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

export function WithdrawButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!window.confirm("Withdraw this proposal? The client will be notified.")) return;
    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/proposals/${proposalId}/withdraw`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => void withdraw()}
        disabled={pending}
      >
        {pending ? "Withdrawing…" : "Withdraw proposal"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

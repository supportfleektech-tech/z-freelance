"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

export function PayoutForm({ balanceCents }: { balanceCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState<"BANK_TRANSFER" | "PAYPAL" | "WISE">("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cents = Math.max(0, Math.round(Number.parseFloat(amount || "0") * 100));
  const invalid = cents <= 0 || cents > balanceCents;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/payouts`, {
        method: "POST",
        body: JSON.stringify({ amountCents: cents, method }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request the payout.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div>
        <label className="label" htmlFor="payoutAmount">
          Amount (USD)
        </label>
        <input
          id="payoutAmount"
          type="number"
          min="0.01"
          step="0.01"
          className={`input ${invalid ? "border-rose-400" : ""}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {invalid ? (
          <p className="mt-1 text-xs text-rose-600">Must be between $0.01 and your balance.</p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="payoutMethod">
          Method
        </label>
        <select
          id="payoutMethod"
          className="input"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="WISE">Wise</option>
          <option value="PAYPAL">PayPal</option>
        </select>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending || invalid}>
        {pending ? "Requesting…" : "Request withdrawal"}
      </button>
    </form>
  );
}

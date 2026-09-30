"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

/** One-click suspension with an audit-logged reason. */
export function SuspendUserButton({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  async function toggle() {
    const reason =
      target === "SUSPENDED"
        ? window.prompt("Suspension reason (sent to the user and audit log):")
        : null;
    if (target === "SUSPENDED" && reason == null) return;
    if (target === "ACTIVE" && !window.confirm("Reinstate this account?")) return;

    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: target, reason: reason?.trim() || undefined }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={target === "SUSPENDED" ? "btn-danger btn-sm" : "btn-success btn-sm"}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {pending ? "Working…" : target === "SUSPENDED" ? "Suspend" : "Reinstate"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

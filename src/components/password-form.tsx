"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      await fetchJson(`/api/auth/password`, {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setStatus({ kind: "ok", message: "Password updated." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {status ? (
        <Alert tone={status.kind === "ok" ? "success" : "error"}>{status.message}</Alert>
      ) : null}
      <div>
        <label className="label" htmlFor="pw-current">
          Current password
        </label>
        <input
          id="pw-current"
          type="password"
          className="input"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="pw-next">
          New password
        </label>
        <input
          id="pw-next"
          type="password"
          className="input"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={10}
        />
        <p className="mt-1 text-xs text-ink-400">
          At least 10 characters with a letter and a number.
        </p>
      </div>
      <button type="submit" className="btn-secondary w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

/**
 * "Message …" button with an inline first-message composer.
 * Opens (or reuses) the thread anchored to the given project/contract/proposal.
 */
export function StartThreadButton(props: {
  projectId?: string;
  contractId?: string;
  proposalId?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function send() {
    setError(null);
    setPending(true);
    try {
      const { data } = await fetchJson<{ threadId: string }>("/api/threads", {
        method: "POST",
        body: JSON.stringify({
          projectId: props.projectId,
          contractId: props.contractId,
          proposalId: props.proposalId,
          body,
        }),
      });
      router.push(`/dashboard/messages?thread=${data.threadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the conversation.");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm w-full" onClick={() => setOpen(true)}>
        <MessageSquare size={14} />
        {props.label}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <textarea
        autoFocus
        className="input min-h-24"
        placeholder="Write your first message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary btn-sm flex-1"
          onClick={() => void send()}
          disabled={pending || body.trim().length === 0}
        >
          {pending ? "Sending…" : "Send"}
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, X, MessageSquare } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

/** Decision buttons for one proposal row in the client workspace. */
export function ProposalActions(props: {
  proposalId: string;
  projectId: string;
  status: string;
  canHire: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function decide(decision: "SHORTLIST" | "REJECT" | "HIRE") {
    if (
      decision === "HIRE" &&
      !window.confirm(
        "Hire this freelancer? A contract will be created at their bid amount, and all other proposals will be rejected.",
      )
    ) {
      return;
    }
    setError(null);
    setPending(decision);
    try {
      await fetchJson(`/api/proposals/${props.proposalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That decision could not be saved.");
      setPending(null);
    }
  }

  async function message() {
    setError(null);
    setPending("MESSAGE");
    try {
      const { data } = await fetchJson<{ threadId: string }>(`/api/threads`, {
        method: "POST",
        body: JSON.stringify({
          proposalId: props.proposalId,
          body: "Hi! I've been reviewing your proposal and would love to discuss a few details before deciding.",
        }),
      });
      router.push(`/dashboard/messages?thread=${data.threadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the conversation.");
      setPending(null);
    }
  }

  return (
    <div className="mt-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {props.canHire ? (
          <button
            type="button"
            className="btn-success btn-sm"
            onClick={() => void decide("HIRE")}
            disabled={pending != null}
          >
            <Check size={14} />
            {pending === "HIRE" ? "Hiring…" : "Hire & create contract"}
          </button>
        ) : null}
        {props.status !== "SHORTLISTED" ? (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void decide("SHORTLIST")}
            disabled={pending != null}
          >
            <Star size={14} />
            Shortlist
          </button>
        ) : null}
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => void message()}
          disabled={pending != null}
        >
          <MessageSquare size={14} />
          {pending === "MESSAGE" ? "Opening…" : "Message"}
        </button>
        <button
          type="button"
          className="btn-danger btn-sm"
          onClick={() => void decide("REJECT")}
          disabled={pending != null}
        >
          <X size={14} />
          Reject
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDollarSign, Send } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";
import { FileUpload } from "./file-upload";

interface Milestone {
  id: string;
  title: string;
  status: string;
  amountCents: number;
}

interface Contract {
  id: string;
  status: string;
}

/**
 * The two-sided state machine as buttons:
 *   PENDING   -> (client) Fund escrow
 *   FUNDED    -> (freelancer) Submit work
 *   SUBMITTED -> (client) Approve & release
 */
export function MilestoneActions({
  milestone,
  contract,
  isClient,
}: {
  milestone: Milestone;
  contract: Contract;
  isClient: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);

  if (contract.status !== "ACTIVE" && contract.status !== "DISPUTED") return null;

  async function act(action: "fund" | "approve", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    setPending(action);
    try {
      await fetchJson(`/api/milestones/${milestone.id}/${action}`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action could not be completed.");
      setPending(null);
    }
  }

  async function submit() {
    setError(null);
    setPending("submit");
    try {
      await fetchJson(`/api/milestones/${milestone.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ submissionNote: note, attachmentIds }),
      });
      setShowSubmit(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the work.");
      setPending(null);
    }
  }

  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="mt-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {isClient && milestone.status === "PENDING" ? (
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending != null}
          onClick={() =>
            void act(
              "fund",
              `Deposit ${dollars(milestone.amountCents)} into escrow for “${milestone.title}”? This is locked until the work is approved or a dispute is resolved.`,
            )
          }
        >
          <CircleDollarSign size={14} />
          {pending === "fund" ? "Funding…" : `Fund escrow · ${dollars(milestone.amountCents)}`}
        </button>
      ) : null}

      {!isClient && milestone.status === "FUNDED" ? (
        showSubmit ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              className="input min-h-24"
              placeholder="Describe what you delivered and where the client can see it…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <FileUpload
              context="MILESTONE"
              disabled={pending != null}
              onChange={(ids) => setAttachmentIds(ids)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => void submit()}
                disabled={pending != null || note.trim().length < 10}
              >
                {pending === "submit" ? "Submitting…" : "Send for review"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setShowSubmit(false)}
                disabled={pending != null}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowSubmit(true)}>
            <Send size={14} />
            Submit work for review
          </button>
        )
      ) : null}

      {isClient && milestone.status === "SUBMITTED" ? (
        <button
          type="button"
          className="btn-success btn-sm"
          disabled={pending != null}
          onClick={() =>
            void act(
              "approve",
              `Approve this delivery and release ${dollars(milestone.amountCents)} from escrow? The freelancer receives it minus the platform fee.`,
            )
          }
        >
          <CheckCircle2 size={14} />
          {pending === "approve" ? "Releasing…" : "Approve & release escrow"}
        </button>
      ) : null}

      {!isClient && milestone.status === "PENDING" ? (
        <p className="text-xs text-ink-500">Waiting for the client to fund this milestone.</p>
      ) : null}
      {!isClient && milestone.status === "SUBMITTED" ? (
        <p className="text-xs text-ink-500">Waiting for the client to review your delivery.</p>
      ) : null}
      {isClient && milestone.status === "FUNDED" ? (
        <p className="text-xs text-ink-500">
          Money is in escrow — waiting for the freelancer to deliver.
        </p>
      ) : null}
    </div>
  );
}

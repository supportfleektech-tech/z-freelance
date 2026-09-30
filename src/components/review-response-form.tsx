"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

/**
 * The review subject's one-shot public reply. Shown on their own reviews
 * page; retraction is possible, replacement is not (a reply should be
 * considered, not iterated).
 */
export function ReviewResponseForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/reviews/${reviewId}/response`, {
        method: "PUT",
        body: JSON.stringify({ text: text.trim() }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The response could not be saved.");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setOpen(true)}>
        Respond publicly
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        autoFocus
        className="input min-h-20"
        placeholder="Thank them, add context, clarify — this appears right under the review, forever attributed to you."
        value={text}
        maxLength={1500}
        onChange={(e) => setText(e.target.value)}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={pending || text.trim().length < 2}
          onClick={() => void submit()}
        >
          {pending ? "Publishing…" : "Publish response"}
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Retraction control under an existing response. */
export function RetractResponseButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retract() {
    if (!window.confirm("Remove your public response to this review?")) return;
    setPending(true);
    try {
      await fetch(`/api/reviews/${reviewId}/response`, {
        method: "DELETE",
        credentials: "include",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="link text-xs"
      disabled={pending}
      onClick={() => void retract()}
    >
      {pending ? "Removing…" : "Retract"}
    </button>
  );
}

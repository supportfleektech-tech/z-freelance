"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { Alert, Card, CardHeader } from "./ui";

/** Two-sided review: whichever party completed the contract rates the other. */
export function ReviewForm({
  contractId,
  subjectName,
}: {
  contractId: string;
  subjectName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fetchJson(`/api/reviews`, {
        method: "POST",
        body: JSON.stringify({ contractId, rating, comment: comment || undefined }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the review.");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Review ${subjectName}`}
        description="Published on their profile, visible to everyone."
      />
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className="rounded p-0.5"
            >
              <Star
                size={24}
                className={value <= rating ? "fill-amber-400 text-amber-400" : "text-ink-300"}
              />
            </button>
          ))}
        </div>

        <textarea
          className="input min-h-24"
          placeholder="What was it like working together? Communication, quality, reliability…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
        />

        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {pending ? "Posting…" : "Post review"}
        </button>
      </form>
    </Card>
  );
}

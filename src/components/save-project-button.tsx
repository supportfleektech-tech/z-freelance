"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

/** Bookmark toggle on open projects (freelancers only — see the API route). */
export function SaveProjectButton({
  projectId,
  initialSaved,
  variant = "ghost",
}: {
  projectId: string;
  initialSaved: boolean;
  /** "ghost" = inline with actions; "card" = compact corner control. */
  variant?: "ghost" | "card";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      const { data } = await fetchJson<{ saved: boolean }>(`/api/projects/${projectId}/save`, {
        method: saved ? "DELETE" : "POST",
      });
      setSaved(data.saved);
      router.refresh();
    } catch {
      // Keep the previous state on failure; the user can retry.
    } finally {
      setPending(false);
    }
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
        aria-label={saved ? "Remove from saved projects" : "Save this project"}
        aria-pressed={saved}
        title={saved ? "Saved — click to remove" : "Save for later"}
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : saved ? (
          <BookmarkCheck size={16} className="text-brand-600" />
        ) : (
          <Bookmark size={16} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      className={saved ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}
      aria-pressed={saved}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : saved ? (
        <BookmarkCheck size={14} />
      ) : (
        <Bookmark size={14} />
      )}
      {saved ? "Saved" : "Save for later"}
    </button>
  );
}

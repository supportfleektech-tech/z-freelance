"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

/** Publish/close buttons for a project the caller owns. */
export function ProjectTransitionButton(props: {
  projectId: string;
  action: "PUBLISH" | "CLOSE" | "CANCEL";
  label: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/projects/${props.projectId}/transition`, {
        method: "POST",
        body: JSON.stringify({ action: props.action }),
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
        onClick={() => void run()}
        disabled={pending}
        className={props.primary ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
      >
        {pending ? "Working…" : props.label}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { FileUpload } from "./file-upload";

export function MessageComposer({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function send() {
    const trimmed = body.trim();
    if ((!trimmed && attachmentIds.length === 0) || pending) return;
    setPending(true);
    setError(null);
    try {
      await fetchJson(`/api/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          threadId,
          body: trimmed || "(attachment)",
          attachmentIds,
        }),
      });
      setBody("");
      setAttachmentIds([]);
      setUploadKey((k) => k + 1); // remount the upload control with a clean slate
      ref.current?.focus();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed to send.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {error ? <p className="mb-2 text-xs text-rose-600">{error}</p> : null}
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <textarea
            ref={ref}
            className="input min-h-11 flex-1 resize-none"
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <FileUpload
            key={uploadKey}
            context="MESSAGE"
            compact
            disabled={pending}
            onChange={(ids) => setAttachmentIds(ids)}
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void send()}
          disabled={pending || (body.trim().length === 0 && attachmentIds.length === 0)}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

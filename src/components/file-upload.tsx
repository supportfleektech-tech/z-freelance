"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";

/**
 * Attach-files control used by the message composer, milestone submission
 * form and portfolio editor.
 *
 * Files upload immediately (so failures surface before the user composes a
 * long message around them); the component reports the linked attachment
 * ids upward via `onChange`. Un-linking an uploaded-but-unused file deletes
 * it server-side.
 */

export interface UploadedFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  context: "MESSAGE" | "MILESTONE" | "PORTFOLIO";
  onChange?: (ids: string[], files: UploadedFileMeta[]) => void;
  max?: number;
  disabled?: boolean;
  /** Compact = paperclip only (composer); otherwise a labelled drop area. */
  compact?: boolean;
  accept?: string;
}

export function FileUpload({ context, onChange, max = 5, disabled, compact, accept }: Props) {
  const [files, setFiles] = useState<UploadedFileMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(next: UploadedFileMeta[]) {
    setFiles(next);
    onChange?.(
      next.map((f) => f.id),
      next,
    );
  }

  async function upload(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setError(null);
    const current = files;
    if (current.length + picked.length > max) {
      setError(`At most ${max} files can be attached.`);
      return;
    }
    setBusy(true);
    try {
      const next = [...current];
      for (const file of Array.from(picked)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/uploads?context=${context}`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const envelope = (await response.json().catch(() => null)) as {
          ok: boolean;
          data?: { attachment: UploadedFileMeta };
          error?: { message?: string };
        } | null;
        if (!response.ok || !envelope?.ok || !envelope.data) {
          throw new Error(envelope?.error?.message ?? `Upload failed (${response.status}).`);
        }
        next.push(envelope.data.attachment);
      }
      commit(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/files/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        const envelope = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(envelope?.error?.message ?? "Could not remove the file.");
      }
      commit(files.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the file.");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={compact ? "btn-ghost btn-sm !px-2" : "btn-ghost btn-sm"}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy || files.length >= max}
          aria-label="Attach files"
          title="Attach files"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          {compact ? null : <span>{busy ? "Uploading…" : "Attach files"}</span>}
        </button>
        {files.map((file) => (
          <span
            key={file.id}
            className="inline-flex max-w-60 items-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50 py-1 pl-2 pr-1 text-xs text-ink-700"
          >
            <FileText size={12} className="shrink-0 text-ink-400" />
            <span className="truncate">{file.fileName}</span>
            <span className="shrink-0 text-ink-400">{formatBytes(file.sizeBytes)}</span>
            <button
              type="button"
              className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
              onClick={() => void remove(file.id)}
              aria-label={`Remove ${file.fileName}`}
              disabled={busy}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Chips for already-submitted attachments (server-rendered views). */
export function AttachmentList({
  attachments,
  tone = "light",
}: {
  attachments: Array<{ id: string; fileName: string; sizeBytes: number }>;
  tone?: "light" | "dark";
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((file) => (
        <a
          key={file.id}
          href={`/api/files/${file.id}`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex max-w-60 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs underline-offset-2 hover:underline ${
            tone === "dark"
              ? "border-brand-400/40 bg-brand-500/30 text-white"
              : "border-ink-200 bg-white text-ink-700"
          }`}
        >
          <FileText size={12} className="shrink-0" />
          <span className="truncate">{file.fileName}</span>
          <span className={tone === "dark" ? "text-brand-200" : "text-ink-400"}>
            {formatBytes(file.sizeBytes)}
          </span>
        </a>
      ))}
    </div>
  );
}

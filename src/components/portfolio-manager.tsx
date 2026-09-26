"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { FileUpload } from "./file-upload";

/**
 * Portfolio CRUD for the owner's dashboard. Cover images go through the
 * normal upload pipeline (context=PORTFOLIO), so they are public by design
 * and render straight from /api/files/:id.
 */

export interface PortfolioItemShape {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageAttachmentId: string | null;
  imageUrl: string | null;
}

interface FormState {
  title: string;
  description: string;
  url: string;
  imageAttachmentId: string | null;
  imageUrl: string | null;
}

const EMPTY: FormState = {
  title: "",
  description: "",
  url: "",
  imageAttachmentId: null,
  imageUrl: null,
};

export function PortfolioManager({ initialItems }: { initialItems: PortfolioItemShape[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [imageTouched, setImageTouched] = useState(false);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setImageTouched(false);
    setUploadKey((k) => k + 1);
    setFormOpen(true);
    setError(null);
  }

  function startEdit(item: PortfolioItemShape) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? "",
      url: item.url ?? "",
      imageAttachmentId: item.imageAttachmentId,
      imageUrl: item.imageUrl,
    });
    setImageTouched(false);
    setUploadKey((k) => k + 1);
    setFormOpen(true);
    setError(null);
  }

  async function save() {
    setError(null);
    setPending(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      url: form.url.trim() || undefined,
    };
    // Only send the image when the user actually changed it — otherwise an
    // edit to the text alone would accidentally unlink an existing cover.
    // Explicit null means "clear the cover".
    if (imageTouched) payload.imageAttachmentId = form.imageAttachmentId;
    try {
      if (editingId) {
        const { data } = await fetchJson<{ item: PortfolioItemShape }>(
          `/api/me/portfolio/${editingId}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setItems((list) => list.map((i) => (i.id === editingId ? data.item : i)));
      } else {
        const { data } = await fetchJson<{ item: PortfolioItemShape }>(`/api/me/portfolio`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setItems((list) => [...list, data.item]);
      }
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the item.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this portfolio item permanently?")) return;
    setError(null);
    try {
      await fetch(`/api/me/portfolio/${id}`, { method: "DELETE", credentials: "include" });
      setItems((list) => list.filter((i) => i.id !== id));
      router.refresh();
    } catch {
      setError("Could not delete the item — please retry.");
    }
  }

  return (
    <div>
      {items.length === 0 && !formOpen ? (
        <p className="text-sm text-ink-500">
          Nothing here yet — add your best pieces. They appear on your public profile above your
          review history.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-ink-200">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded portfolio art, exact intrinsic size unknown
                <img src={item.imageUrl} alt={item.title} className="h-32 w-full object-cover" />
              ) : null}
              <div className="p-3">
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600">{item.description}</p>
                ) : null}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                  >
                    {item.url.replace(/^https?:\/\//, "").slice(0, 40)} <ExternalLink size={11} />
                  </a>
                ) : null}
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-600"
                    onClick={() => void remove(item.id)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <p className="text-sm font-semibold text-ink-900">
            {editingId ? "Edit portfolio item" : "New portfolio item"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-600">Title *</span>
              <input
                className="input"
                value={form.title}
                maxLength={140}
                placeholder="e.g. Checkout redesign for Nairobi fintech"
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-600">Project link</span>
              <input
                className="input"
                value={form.url}
                maxLength={300}
                placeholder="https://…"
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-600">Description</span>
            <textarea
              className="input min-h-20"
              value={form.description}
              maxLength={2000}
              placeholder="What was the outcome, what did you personally deliver?"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Cover image (public, optional)
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- freshly uploaded preview
                <img
                  src={form.imageUrl}
                  alt="Cover preview"
                  className="h-16 w-24 rounded-lg border border-ink-200 object-cover"
                />
              ) : null}
              <FileUpload
                key={uploadKey}
                context="PORTFOLIO"
                max={1}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(ids) => {
                  setImageTouched(true);
                  setForm((f) => ({
                    ...f,
                    imageAttachmentId: ids[0] ?? null,
                    imageUrl: ids[0] ? `/api/files/${ids[0]}` : null,
                  }));
                }}
              />
              <span className="text-xs text-ink-400">PNG, JPEG, WebP or GIF — up to 10 MB.</span>
            </div>
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={pending || form.title.trim().length < 3}
              onClick={() => void save()}
            >
              {pending ? "Saving…" : editingId ? "Save changes" : "Publish item"}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={pending}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={startCreate}>
          <Plus size={14} /> Add portfolio item
        </button>
      )}
    </div>
  );
}

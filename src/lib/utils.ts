import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** URL-safe slug from an arbitrary title. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

/** Collision-resistant slug suffix (used to keep project slugs unique). */
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Build a unique slug, appending a short suffix when the base is empty. */
export function uniqueSlug(title: string): string {
  const base = slugify(title) || "project";
  return `${base}-${slugSuffix()}`;
}

/** Strip tags and collapse whitespace — used for list excerpts. */
export function excerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? "").toUpperCase())
    .join("");
}

/** Deterministic avatar colour derived from a string id. */
export function avatarTone(seed: string): string {
  const palette = [
    "bg-brand-100 text-brand-800",
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-800",
    "bg-rose-100 text-rose-800",
    "bg-violet-100 text-violet-800",
    "bg-cyan-100 text-cyan-800",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length] ?? "bg-ink-100 text-ink-800";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function timeAgo(value: Date | string | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return "—";
  if (seconds < 60) return "just now";
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86_400],
    ["week", 604_800],
    ["month", 2_592_000],
    ["year", 31_536_000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = ["minute", 60];
  for (const unit of units) {
    if (Math.abs(seconds) >= unit[1]) chosen = unit;
  }
  return rtf.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

/** Human label for the enum values used across the UI. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Clamp a page size into a safe range. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Parse `?page=&pageSize=` into safe pagination bounds. */
export function pagination(
  raw: { page?: string | null; pageSize?: string | null },
  defaults: { pageSize: number; maxPageSize: number },
): { page: number; pageSize: number; offset: number } {
  const page = clamp(Number.parseInt(raw.page ?? "1", 10) || 1, 1, 10_000);
  const pageSize = clamp(
    Number.parseInt(raw.pageSize ?? String(defaults.pageSize), 10) || defaults.pageSize,
    1,
    defaults.maxPageSize,
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Total number of pages for a result set. */
export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Normalise a user-entered URL, rejecting non-http(s) schemes. */
export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let trimmed = input.trim();
  if (!trimmed) return null;

  // If a scheme is present it must be http(s) — never accept "https://<scheme>://…".
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1]?.toLowerCase();
    if (scheme !== "http" && scheme !== "https") return null;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Split a comma- or newline-separated list into trimmed, de-duplicated items. */
export function parseList(input: string, max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,\n]/)) {
    const value = part.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

import { cn, initials, avatarTone } from "@/lib/utils";
import { formatDate, timeAgo } from "@/lib/utils";
import { Star } from "lucide-react";

/* ------------------------------------------------------------ typography */

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {props.eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
            {props.eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
          {props.title}
        </h1>
        {props.description ? (
          <p className="mt-2 max-w-2xl text-sm text-ink-600">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="flex shrink-0 items-center gap-2">{props.actions}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ card */

export function Card(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card p-5", props.className)}>{props.children}</div>;
}

export function CardHeader(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{props.title}</h2>
        {props.description ? (
          <p className="mt-0.5 text-sm text-ink-500">{props.description}</p>
        ) : null}
      </div>
      {props.actions}
    </div>
  );
}

/* ----------------------------------------------------------------- badge */

type BadgeTone = "gray" | "blue" | "green" | "amber" | "rose" | "violet" | "emerald";

const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-ink-100 text-ink-700",
  blue: "bg-brand-100 text-brand-800",
  green: "bg-emerald-100 text-emerald-800",
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  rose: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
};

export function Badge(props: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("badge", badgeTones[props.tone ?? "gray"], props.className)}>
      {props.children}
    </span>
  );
}

/** Canonical colour for each workflow status — used consistently everywhere. */
export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, BadgeTone> = {
    DRAFT: "gray",
    OPEN: "green",
    IN_PROGRESS: "blue",
    CLOSED: "gray",
    CANCELLED: "rose",
    PENDING: "amber",
    SHORTLISTED: "violet",
    REJECTED: "rose",
    WITHDRAWN: "gray",
    HIRED: "green",
    ACTIVE: "green",
    COMPLETED: "blue",
    DISPUTED: "rose",
    FUNDED: "blue",
    SUBMITTED: "violet",
    RELEASED: "green",
    REFUNDED: "gray",
    SUSPENDED: "rose",
    IN_REVIEW: "amber",
    RESOLVED_CLIENT: "blue",
    RESOLVED_FREELANCER: "blue",
    REQUESTED: "amber",
    PROCESSING: "blue",
    PAID: "green",
    FAILED: "rose",
    AVAILABLE: "green",
    BUSY: "amber",
    UNAVAILABLE: "gray",
    SETTLED: "green",
    ENTRY: "gray",
    INTERMEDIATE: "blue",
    EXPERT: "violet",
  };
  return <Badge tone={tones[status] ?? "gray"}>{status.replace(/_/g, " ")}</Badge>;
}

/* ----------------------------------------------------------------- stats */

export function Stat(props: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{props.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink-950">{props.value}</p>
      {props.hint ? <p className="mt-1 text-xs text-ink-500">{props.hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- people */

export function Avatar(props: {
  name: string;
  id: string;
  size?: "sm" | "md" | "lg";
  avatarUrl?: string | null;
}) {
  const size = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-lg" }[
    props.size ?? "md"
  ];
  if (props.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar URLs
      <img
        src={props.avatarUrl}
        alt={props.name}
        className={cn(size, "rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        size,
        avatarTone(props.id),
        "inline-flex items-center justify-center rounded-full font-semibold",
      )}
    >
      {initials(props.name)}
    </span>
  );
}

export function Stars(props: { rating: number; count?: number; size?: number }) {
  const full = Math.round(props.rating);
  return (
    <span className="inline-flex items-center gap-0.5" title={`${props.rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={props.size ?? 14}
          className={i <= full ? "fill-amber-400 text-amber-400" : "text-ink-300"}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-xs font-medium text-ink-600">
        {props.rating > 0 ? props.rating.toFixed(1) : "New"}
        {props.count != null && props.count > 0 ? ` (${props.count})` : ""}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------- meta */

export function MetaRow(props: {
  items: Array<{ label: string; value: React.ReactNode }>;
  cols?: 1 | 2 | 3 | 4;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[
    props.cols ?? 3
  ];
  return (
    <dl className={cn("grid grid-cols-1 gap-4", cols)}>
      {props.items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{item.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timestamp(props: {
  value: Date | string | null | undefined;
  mode?: "date" | "ago";
}) {
  const v = props.value;
  return (
    <time className="text-sm text-ink-500" dateTime={v ? new Date(v).toISOString() : undefined}>
      {props.mode === "ago" ? timeAgo(v) : formatDate(v)}
    </time>
  );
}

/* ------------------------------------------------------------- empty/alert */

export function EmptyState(props: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-2xl">
        ✳︎
      </div>
      <h3 className="text-base font-semibold text-ink-900">{props.title}</h3>
      {props.description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-500">{props.description}</p>
      ) : null}
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}

export function Alert(props: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <div
      role="alert"
      className={cn("rounded-lg border px-4 py-3 text-sm", tones[props.tone ?? "info"])}
    >
      {props.children}
    </div>
  );
}

/* ------------------------------------------------------------ pagination */

export function Pagination(props: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));
  if (pages <= 1) return null;

  const href = (page: number) => {
    const search = new URLSearchParams(props.params ?? {});
    search.set("page", String(page));
    return `${props.basePath}?${search.toString()}`;
  };

  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
      <p className="text-sm text-ink-500">
        Page <span className="font-medium text-ink-900">{props.page}</span> of{" "}
        <span className="font-medium text-ink-900">{pages}</span> · {props.total} results
      </p>
      <div className="flex gap-2">
        {props.page > 1 ? (
          <a className="btn-secondary btn-sm" href={href(props.page - 1)}>
            ← Previous
          </a>
        ) : null}
        {props.page < pages ? (
          <a className="btn-secondary btn-sm" href={href(props.page + 1)}>
            Next →
          </a>
        ) : null}
      </div>
    </nav>
  );
}

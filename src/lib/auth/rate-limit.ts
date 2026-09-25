/**
 * Fixed-window in-memory rate limiter.
 *
 * Scoped to a single process, which is correct for the single-container
 * deployment this repo ships and is used here to blunt credential-stuffing
 * against `/api/auth/*`. For a multi-instance deployment, swap the `Map` for
 * the same interface backed by Redis (`INCR` + `EXPIRE`) — the call sites do
 * not change.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Opportunistic cleanup so a burst of unique keys cannot grow the map forever. */
let lastSweep = Date.now();
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit: max, remaining: max - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  return {
    ok: existing.count <= max,
    limit: max,
    remaining: Math.max(0, max - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test helper. */
export function __resetRateLimiter(): void {
  buckets.clear();
  lastSweep = Date.now();
}

/**
 * Money helpers.
 *
 * Rules that this module enforces and the test-suite protects:
 *
 * 1. Currency is represented as **integer minor units (cents)** everywhere —
 *    in the database, across the API and in the UI. Floating point is never
 *    used for arithmetic on money.
 * 2. The platform fee is computed with `Math.floor`, so rounding always
 *    favours the freelancer; the platform never over-charges.
 * 3. `fee + payout === amount` holds for every possible input, because the
 *    payout is derived as the remainder rather than rounded independently.
 */

export const BPS_DENOMINATOR = 10_000;

/** Convert a decimal currency amount ("12.50") into integer cents (1250). */
export function toCents(amount: number | string): number {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot convert "${String(amount)}" to cents: not a finite number`);
  }
  // Math.round guards against binary floating point drift (e.g. 1.005 * 100).
  return Math.round((value + Number.EPSILON) * 100);
}

/** Convert integer cents into a decimal currency amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Platform fee for a given amount, using round-half-down (floor) so the
 * freelancer is never short-changed by a rounding artefact.
 */
export function platformFeeCents(amountCents: number, bps: number): number {
  assertInt(amountCents, "amountCents");
  assertInt(bps, "bps");
  if (amountCents < 0) throw new RangeError("amountCents must be non-negative");
  if (bps < 0 || bps > BPS_DENOMINATOR) throw new RangeError("bps must be between 0 and 10000");
  return Math.floor((amountCents * bps) / BPS_DENOMINATOR);
}

/** What the freelancer receives after the platform fee is deducted. */
export function freelancerPayoutCents(amountCents: number, bps: number): number {
  return amountCents - platformFeeCents(amountCents, bps);
}

/** Basis points rendered as a human percentage string ("1000" -> "10%"). */
export function bpsToPercent(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

/** Sum a list of cent amounts without floating point drift. */
export function sumCents(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}

/** Whole percentage split used for milestone plans (last slice absorbs rounding). */
export function splitByPercentages(amountCents: number, percentages: number[]): number[] {
  assertInt(amountCents, "amountCents");
  if (amountCents < 0) throw new RangeError("amountCents must be non-negative");
  if (percentages.length === 0) throw new RangeError("percentages must not be empty");
  const total = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new RangeError(`percentages must sum to 100 (got ${total})`);
  }
  const parts = percentages.map((p) => Math.floor((amountCents * p) / 100));
  const remainder = amountCents - parts.reduce((a, b) => a + b, 0);
  const last = parts.length - 1;
  parts[last] = (parts[last] ?? 0) + remainder;
  return parts;
}

/** Format cents for display, e.g. 125000 -> "$1,250.00". */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
}

/** Compact format for ranges and cards, e.g. 125000 -> "$1.3k". */
export function formatMoneyCompact(cents: number, currency = "USD"): string {
  if (Math.abs(cents) < 100_000) return formatMoney(cents, currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(fromCents(cents));
}

/** Render a budget range, handling open-ended and undisclosed budgets. */
export function formatBudget(
  minCents: number | null,
  maxCents: number | null,
  budgetType: "FIXED" | "HOURLY" = "FIXED",
  currency = "USD",
): string {
  const suffix = budgetType === "HOURLY" ? "/hr" : "";
  if (minCents == null && maxCents == null) return "Budget undisclosed";
  if (minCents != null && maxCents == null)
    return `${formatMoneyCompact(minCents, currency)}+${suffix}`;
  if (minCents == null && maxCents != null)
    return `Up to ${formatMoneyCompact(maxCents, currency)}${suffix}`;
  if (minCents === maxCents) return `${formatMoney(minCents ?? 0, currency)}${suffix}`;
  return `${formatMoneyCompact(minCents ?? 0, currency)} – ${formatMoneyCompact(maxCents ?? 0, currency)}${suffix}`;
}

function assertInt(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer number of cents (got ${value})`);
  }
}

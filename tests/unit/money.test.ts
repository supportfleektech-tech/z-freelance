import { describe, expect, it } from "vitest";
import {
  bpsToPercent,
  formatBudget,
  formatMoney,
  formatMoneyCompact,
  freelancerPayoutCents,
  fromCents,
  platformFeeCents,
  splitByPercentages,
  sumCents,
  toCents,
} from "@/lib/money";

describe("toCents", () => {
  it("converts decimal amounts to integer cents", () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents("10500.75")).toBe(1_050_075);
    expect(toCents(0.01)).toBe(1);
  });

  it("handles the classic float drift case", () => {
    // 1.005 is stored as 1.0049999999999998934..., a naive *100 would round down.
    expect(toCents(1.005)).toBe(101);
    expect(toCents("1.005")).toBe(101);
  });

  it("rejects non-finite input", () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("platform fee", () => {
  it("always rounds in the freelancer's favour", () => {
    // 10% of 501 cents = 50.1 → floor = 50, so the freelancer keeps the extra tenth of a cent.
    expect(platformFeeCents(501, 1000)).toBe(50);
    expect(freelancerPayoutCents(501, 1000)).toBe(451);
  });

  it("fee + payout always equals the amount", () => {
    for (const amount of [1, 7, 99, 501, 10_499, 100_001, 9_999_999]) {
      for (const bps of [0, 1, 250, 1000, 2500, 5000, 10_000]) {
        expect(platformFeeCents(amount, bps) + freelancerPayoutCents(amount, bps)).toBe(amount);
      }
    }
  });

  it("handles boundary bps", () => {
    expect(platformFeeCents(10_000, 0)).toBe(0);
    expect(platformFeeCents(10_000, 10_000)).toBe(10_000);
    expect(() => platformFeeCents(10_000, -1)).toThrow(RangeError);
    expect(() => platformFeeCents(10_000, 10_001)).toThrow(RangeError);
    expect(() => platformFeeCents(-1, 1000)).toThrow(RangeError);
  });

  it("rejects fractional cents", () => {
    expect(() => platformFeeCents(1.5, 1000)).toThrow(RangeError);
  });
});

describe("splitByPercentages", () => {
  it("splits evenly when divisible", () => {
    expect(splitByPercentages(10_000, [50, 50])).toEqual([5000, 5000]);
    expect(splitByPercentages(9_000, [40, 30, 30])).toEqual([3600, 2700, 2700]);
  });

  it("absorbs rounding in the final slice and always totals the input", () => {
    const parts = splitByPercentages(10_001, [33.33, 33.33, 33.34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_001);

    for (const total of [1, 2, 3, 101, 999_999]) {
      const slices = splitByPercentages(total, [20, 30, 50]);
      expect(slices.reduce((a, b) => a + b, 0)).toBe(total);
      for (const slice of slices) expect(slice).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects plans that don't total 100%", () => {
    expect(() => splitByPercentages(100, [50, 40])).toThrow(RangeError);
    expect(() => splitByPercentages(100, [])).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("formats money in the platform locale", () => {
    expect(formatMoney(1_050_000)).toBe("$10,500.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5_000)).toBe("$50.00");
  });

  it("formats compact and full amounts", () => {
    expect(formatMoneyCompact(50_000)).toBe("$500.00");
    expect(formatMoneyCompact(1_050_000)).toBe("$10.5K");
  });

  it("renders budget shapes readably", () => {
    expect(formatBudget(null, null, "FIXED")).toBe("Budget undisclosed");
    expect(formatBudget(5_000, 5_000, "FIXED")).toBe("$50.00");
    expect(formatBudget(5_000, null, "HOURLY")).toBe("$50.00+/hr");
    expect(formatBudget(null, 5_000, "FIXED")).toBe("Up to $50.00");
    expect(formatBudget(5_000, 8_000, "FIXED")).toBe("$50.00 – $80.00");
    expect(formatBudget(5_000, 8_000, "HOURLY")).toBe("$50.00 – $80.00/hr");
  });

  it("renders basis points as percentages", () => {
    expect(bpsToPercent(1000)).toBe("10%");
    expect(bpsToPercent(250)).toBe("2.50%");
  });

  it("sumCents ignores nullish values and stays exact", () => {
    expect(sumCents([1, 2, null, 3, undefined])).toBe(6);
    expect(sumCents([])).toBe(0);
  });

  it("fromCents is exact", () => {
    expect(fromCents(1_050_075)).toBe(10500.75);
  });
});

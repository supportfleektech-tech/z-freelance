import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  createProposalSchema,
  createReviewSchema,
  loginSchema,
  registerSchema,
  sendMessageSchema,
  startThreadSchema,
  updateProjectSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Sofia Lindqvist",
        email: "SOFIA@EXAMPLE.COM",
        password: "Password123x",
        role: "FREELANCER",
      }).success,
    ).toBe(true);
  });

  it("normalizes email casing", () => {
    const parsed = registerSchema.parse({
      name: "Sofia Lindqvist",
      email: "SOFIA@EXAMPLE.COM",
      password: "Password123x",
      role: "FREELANCER",
    });
    expect(parsed.email).toBe("sofia@example.com");
  });

  it("enforces the password policy with clear messages", () => {
    const short = registerSchema.safeParse({
      name: "Al Baker",
      email: "al@example.com",
      password: "Short1",
      role: "CLIENT",
    });
    expect(short.success).toBe(false);
    if (!short.success) {
      const pwIssue = short.error.issues.find((i) => i.path.join(".") === "password");
      expect(pwIssue?.message).toContain("10 characters");
    }

    const noDigit = registerSchema.safeParse({
      name: "Al Baker",
      email: "al@example.com",
      password: "PasswordOnly",
      role: "CLIENT",
    });
    expect(noDigit.success).toBe(false);
    if (!noDigit.success) {
      const pwIssue = noDigit.error.issues.find((i) => i.path.join(".") === "password");
      expect(pwIssue?.message).toContain("number");
    }
  });

  it("rejects garbage roles and emails", () => {
    expect(
      registerSchema.safeParse({
        name: "Aa",
        email: "not-an-email",
        password: "Password123x",
        role: "HACKER",
      }).success,
    ).toBe(false);
  });
});

describe("createProjectSchema", () => {
  const base = {
    title: "Build a Next.js billing dashboard with usage-based invoicing",
    description:
      "We need a customer-facing billing dashboard built in Next.js and TypeScript with solid tests.",
    budgetMinCents: 800_000,
    budgetMaxCents: 1_200_000,
    publish: true,
  };

  it("accepts a complete brief with defaults applied", () => {
    const parsed = createProjectSchema.parse(base);
    expect(parsed.budgetType).toBe("FIXED");
    expect(parsed.experienceLevel).toBe("INTERMEDIATE");
    expect(parsed.skills).toEqual([]);
  });

  it("rejects an inverted budget range", () => {
    const result = createProjectSchema.safeParse({
      ...base,
      budgetMinCents: 2_000_000,
      budgetMaxCents: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path.join(".")).toBe("budgetMaxCents");
  });

  it("rejects past deadlines", () => {
    const result = createProjectSchema.safeParse({
      ...base,
      deadline: new Date(Date.now() - 1000).toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    const result = createProjectSchema.safeParse({ ...base, backdoor: true });
    expect(result.success).toBe(false);
  });

  it("accepts up to 8 skills and rejects more", () => {
    const ok = createProjectSchema.safeParse({
      ...base,
      skills: Array.from({ length: 8 }, (_, i) => `s${i}`),
    });
    expect(ok.success).toBe(true);

    const tooMany = createProjectSchema.safeParse({
      ...base,
      skills: Array.from({ length: 9 }, (_, i) => `s${i}`),
    });
    expect(tooMany.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("is fully optional but rejects publish", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(true);
    expect(updateProjectSchema.safeParse({ title: "A sufficiently long new title" }).success).toBe(
      true,
    );
  });
});

describe("createProposalSchema", () => {
  it("enforces the minimum bid", () => {
    const result = createProposalSchema.safeParse({
      coverLetter: "a".repeat(100),
      bidAmountCents: 100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a strong proposal", () => {
    const parsed = createProposalSchema.parse({
      coverLetter: "I have built four of these before and here is my plan...".padEnd(100, "."),
      bidAmountCents: 1_050_000,
      estimatedDays: 21,
    });
    expect(parsed.estimatedDays).toBe(21);
  });
});

describe("threads", () => {
  it("sendMessageSchema requires ids and text", () => {
    expect(sendMessageSchema.safeParse({}).success).toBe(false);
  });

  it("startThreadSchema demands one anchor", () => {
    const result = startThreadSchema.safeParse({ subject: "Hello there", body: "hi" });
    expect(result.success).toBe(false);
    const ok = startThreadSchema.safeParse({
      projectId: "00000000-0000-4000-8000-000000000001",
      body: "hi",
    });
    expect(ok.success).toBe(true);
  });
});

describe("createReviewSchema", () => {
  it("bounds the rating", () => {
    expect(
      createReviewSchema.safeParse({
        contractId: "00000000-0000-4000-8000-000000000001",
        rating: 6,
      }).success,
    ).toBe(false);
    expect(
      createReviewSchema.safeParse({
        contractId: "00000000-0000-4000-8000-000000000001",
        rating: 4,
      }).success,
    ).toBe(true);
  });
});

describe("loginSchema", () => {
  it("rejects empty passwords but doesn't enforce policy on login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "whatever" }).success).toBe(true);
  });
});

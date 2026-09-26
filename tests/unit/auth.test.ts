import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { rateLimit, __resetRateLimiter } from "@/lib/auth/rate-limit";
import { passwordSchema } from "@/lib/validation/auth";

describe("password hashing", () => {
  it("round-trips and never stores plaintext", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toContain("Password123!");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("Password123!", hash)).toBe(true);
    expect(await verifyPassword("Password124!", hash)).toBe(false);
  });

  it("different salts per hash", async () => {
    const a = await hashPassword("Password123!");
    const b = await hashPassword("Password123!");
    expect(a).not.toBe(b);
  });

  it("dummy comparison resolves without leaking", async () => {
    await expect(verifyAgainstDummy("Password123!")).resolves.toBeUndefined();
    await expect(verifyAgainstDummy("")).resolves.toBeUndefined();
  });

  it("verifyPassword survives malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-bcrypt-hash")).toBe(false);
  });
});

describe("password policy", () => {
  it("accepts and rejects as documented", () => {
    expect(passwordSchema.safeParse("Password123!").success).toBe(true);
    expect(passwordSchema.safeParse("passwordonly").success).toBe(false);
    expect(passwordSchema.safeParse("12345abcde").success).toBe(true);
    expect(passwordSchema.safeParse("12345abcd").success).toBe(false);
  });
});

describe("session tokens", () => {
  it("signs and verifies a token carrying the user id and role", async () => {
    const token = await createSessionToken("user-1", "FREELANCER");
    const payload = await verifySessionToken(token);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.role).toBe("FREELANCER");
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload?.jti).toBeTruthy();
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken("user-1", "CLIENT");
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage and wrong-audience-ish input", async () => {
    expect(await verifySessionToken("eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.")).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows up to the limit and blocks past it", () => {
    __resetRateLimiter();
    const policy = { windowMs: 60_000, max: 3 };
    expect(rateLimit("k1", policy).ok).toBe(true); // 1
    expect(rateLimit("k1", policy).ok).toBe(true); // 2
    expect(rateLimit("k1", policy).ok).toBe(true); // 3
    const blocked = rateLimit("k1", policy); // 4
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    __resetRateLimiter();
    const policy = { windowMs: 60_000, max: 1 };
    rateLimit("a", policy);
    expect(rateLimit("b", policy).ok).toBe(true);
  });

  it("recovers after the window resets", () => {
    __resetRateLimiter();
    const policy = { windowMs: -1, max: 1 }; // negative window = instantly expired
    rateLimit("z", policy);
    expect(rateLimit("z", policy).ok).toBe(true);
  });
});

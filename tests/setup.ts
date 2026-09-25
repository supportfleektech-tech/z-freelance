import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Test environment bootstrap.
 *
 * - Each test process gets its own isolated embedded Postgres directory.
 * - Low bcrypt cost keeps hashing fast; the policy still applies.
 * - Deterministic secrets and fee rates so assertions are stable.
 */
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret-key-for-jwt-signing-only";
process.env.PASSWORD_ROUNDS = "4";
process.env.PLATFORM_FEE_BPS = "1000";
process.env.MIN_BID_CENTS = "500";
process.env.CURRENCY = "USD";
delete process.env.DATABASE_URL;

const isolatedDir = mkdtempSync(path.join(tmpdir(), "zf-test-pg-"));
process.env.PGLITE_DATA_DIR = path.join(isolatedDir, "db");

process.on("error", (err) => {
  console.error(err);
});

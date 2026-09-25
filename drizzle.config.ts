import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * `dialect: postgresql` is correct for both drivers: production runs real
 * Postgres via DATABASE_URL, while local dev/CI runs PGlite (Postgres compiled
 * to WASM), which accepts the same generated SQL.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : undefined,
});

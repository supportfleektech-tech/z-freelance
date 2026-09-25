import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Database client factory.
 *
 * One schema, two interchangeable drivers:
 *
 * - `DATABASE_URL` set  -> `node-postgres` against a real Postgres server.
 *   This is what runs in production (see Dockerfile / docker-compose.yml).
 * - `DATABASE_URL` unset -> embedded **PGlite** (Postgres compiled to WASM)
 *   writing to `PGLITE_DATA_DIR`. Same SQL dialect, zero infrastructure —
 *   ideal for local dev, the CI pipeline and the test suite.
 *
 * Both drivers implement the `pg-core` dialect, so schema, migrations and
 * queries are identical everywhere. The PGlite instance is typed as the
 * node-postgres database because the two only differ in their query executor;
 * the query-builder surface used throughout this codebase is the same.
 */
export type Database = NodePgDatabase<typeof schema>;

/** A transaction handle — interchangeable with `Database` at call sites. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Anything a service can run queries against. */
export type DbOrTx = Database | Tx;

type Cached = {
  db: Database;
  driver: "postgres" | "pglite";
  /** The underlying driver connection (pg Pool or PGlite). */
  client: unknown;
};

const globalForDb = globalThis as unknown as { __zFreelanceDb?: Cached };

async function create(): Promise<Cached> {
  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      // Fail fast instead of hanging when the database is unreachable.
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => {
      console.error("[db] idle client error", err);
    });
    return { db: drizzleNodePg(pool, { schema }), driver: "postgres", client: pool };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR || ".pgdata";
  const client = new PGlite(dataDir);
  return { db: drizzlePglite(client, { schema }) as unknown as Database, driver: "pglite", client };
}

/** Lazily-initialised, process-wide database handle (survives HMR in dev). */
export async function db(): Promise<Database> {
  if (!globalForDb.__zFreelanceDb) {
    globalForDb.__zFreelanceDb = await create();
  }
  return globalForDb.__zFreelanceDb.db;
}

/** Which driver is active — surfaced by `/api/health` for operator clarity. */
export async function dbDriver(): Promise<"postgres" | "pglite"> {
  if (!globalForDb.__zFreelanceDb) {
    globalForDb.__zFreelanceDb = await create();
  }
  return globalForDb.__zFreelanceDb.driver;
}

/** Test helper: drop the cached handle so a fresh database is created. */
export function __resetDb(): void {
  delete globalForDb.__zFreelanceDb;
}

/**
 * Test/advanced hook: the underlying driver connection for the cached handle.
 * Used by the integration suite to run migrations against the exact same
 * embedded Postgres the app talks to.
 */
export async function __rawClient(): Promise<unknown> {
  if (!globalForDb.__zFreelanceDb) {
    globalForDb.__zFreelanceDb = await create();
  }
  return globalForDb.__zFreelanceDb.client;
}

/** Convenience wrapper so callers can write `withDb(async (db) => ...)`. */
export async function withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  return fn(await db());
}

export { schema };

#!/usr/bin/env node
/**
 * Apply pending SQL migrations — plain Node so it runs in the production
 * image (no TypeScript toolchain required at runtime).
 *
 *   DATABASE_URL set   -> migrates a real Postgres server via node-postgres
 *   DATABASE_URL unset -> migrates the embedded PGlite database
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

function assertMigrationsPresent() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  if (files.length === 0) {
    throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}. Run \`npm run db:generate\`.`);
  }
  return files;
}

async function migratePostgres(url) {
  const [{ default: pg }, { drizzle }, { migrate }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
    import("drizzle-orm/node-postgres/migrator"),
  ]);
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

async function migratePglite(dataDir) {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite(dataDir);
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
  await client.close();
}

async function main() {
  const files = assertMigrationsPresent();
  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    console.log(`[migrate] applying ${files.length} migration(s) to Postgres`);
    await migratePostgres(url);
  } else {
    const dataDir = process.env.PGLITE_DATA_DIR ?? ".pgdata";
    console.log(`[migrate] applying ${files.length} migration(s) to PGlite at ./${dataDir}`);
    await migratePglite(dataDir);
  }
  console.log("[migrate] up to date");
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});

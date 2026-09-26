#!/usr/bin/env node
/**
 * Garbage-collect abandoned uploads — plain Node so it runs in the production
 * image without a TypeScript toolchain, mirroring scripts/migrate.mjs.
 *
 * Sweeps attachment rows (and their bytes) that were uploaded but never
 * linked to a message or a milestone, aren't referenced by a portfolio item,
 * and are older than the grace window (default 24h).
 *
 *   npm run uploads:gc                 # 24h grace
 *   GC_MAX_AGE_HOURS=1 npm run uploads:gc
 *
 * Wire it to cron (or a scheduled job) in production — the upload form makes
 * orphans inevitable (composer closed, form abandoned).
 */
import { readdirSync, rmSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const hours = Number(process.env.GC_MAX_AGE_HOURS ?? 24);
if (!Number.isFinite(hours) || hours <= 0) {
  throw new Error("GC_MAX_AGE_HOURS must be a positive number.");
}
const cutoff = new Date(Date.now() - hours * 3_600_000);
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? ".uploads");

const ORPHAN_SQL = `
  select a.id, a.storage_key
  from attachments a
  where a.message_id is null
    and a.milestone_id is null
    and a.created_at < $1
    and not exists (
      select 1 from portfolio_items p where p.image_attachment_id = a.id
    )
`;
const DELETE_SQL = `delete from attachments where id = any($1::uuid[])`;

async function withClient(fn) {
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      return await fn({
        query: (text, params) => pool.query(text, params).then((r) => r.rows),
      });
    } finally {
      await pool.end();
    }
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? ".pgdata");
  try {
    return await fn({
      query: async (text, params) => (await client.query(text, params)).rows,
    });
  } finally {
    await client.close();
  }
}

const result = await withClient(async (db) => {
  const orphans = await db.query(ORPHAN_SQL, [cutoff]);

  if (orphans.length > 0) {
    await db.query(DELETE_SQL, [orphans.map((o) => o.id)]);
  }

  let files = 0;
  let strayBytes = 0;
  if (existsSync(uploadDir)) {
    const onDisk = new Set(readdirSync(uploadDir));
    for (const orphan of orphans) {
      if (!onDisk.has(orphan.storage_key)) continue;
      onDisk.delete(orphan.storage_key);
      try {
        rmSync(path.join(uploadDir, orphan.storage_key));
        files += 1;
      } catch {
        // Bytes already gone — the row removal is the guarantee.
      }
    }

    // Phase 2: bytes with NO row at all (e.g. rows lost to a cascade that
    // predates eager byte cleanup). Older than the grace window → not the
    // product of an in-flight upload → safe to sweep. This class is
    // impossible for the row-driven service GC to see.
    const rows = await db.query("select storage_key from attachments", []);
    const referenced = new Set(rows.map((r) => r.storage_key));
    for (const name of onDisk) {
      if (referenced.has(name)) continue;
      const filePath = path.join(uploadDir, name);
      try {
        const { mtimeMs } = statSync(filePath);
        if (mtimeMs < cutoff.getTime()) {
          rmSync(filePath);
          strayBytes += 1;
        }
      } catch {
        // Not stat-able/removable — leave it; an ops pass will surface it.
      }
    }
  }
  return { rows: orphans.length, files, strayBytes };
});

console.log(
  `[uploads-gc] swept ${result.rows} orphaned row(s), removed ${result.files} file(s) + ` +
    `${result.strayBytes} row-less stray(s) (grace ${hours}h, cutoff ${cutoff.toISOString()})`,
);

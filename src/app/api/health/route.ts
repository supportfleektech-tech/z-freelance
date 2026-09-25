import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, dbDriver } from "@/lib/db";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe.
 *
 * `status: "ok"` means the process is up; `database: "up"` means a round-trip
 * to Postgres succeeded, which is what a load balancer should gate traffic on.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const database = await db();
    await database.execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      service: config.name,
      version: process.env.npm_package_version ?? "1.0.0",
      driver: await dbDriver(),
      database: "up",
      dataDir: (await dbDriver()) === "pglite" ? process.env.PGLITE_DATA_DIR ?? ".pgdata" : null,
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        service: config.name,
        driver: await dbDriver().catch(() => "unknown"),
        database: "down",
        error: error instanceof Error ? error.message : "unknown",
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

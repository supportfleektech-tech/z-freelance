import type { NextRequest } from "next/server";
import { ok, route, throttle } from "@/lib/api/http";
import { listCategories, skillUsage } from "@/server/services/taxonomy.service";
import { db as getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/categories — taxonomy used by filters and the post-a-project form. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "categories");

  const database = await getDb();
  const [categories, topSkills] = await Promise.all([
    listCategories(database),
    skillUsage(database, 24),
  ]);

  return ok({ categories, topSkills });
});

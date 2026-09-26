import type { NextRequest } from "next/server";
import { created, parseBody, route, throttle } from "@/lib/api/http";
import { createCategorySchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { createCategory } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** POST /api/admin/categories — add a marketplace category. */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "admin:categories");

  await requireRole("ADMIN");
  const input = await parseBody(request, createCategorySchema);

  return created(await createCategory(input));
});

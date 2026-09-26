import { ok, route } from "@/lib/api/http";
import { requireRole } from "@/lib/auth/guards";
import { listSavedProjects } from "@/server/services/saved-projects.service";

export const dynamic = "force-dynamic";

/** GET /api/me/saved-projects — the caller's bookmarked projects. */
export const GET = route(async () => {
  const user = await requireRole("FREELANCER");
  return ok({ items: await listSavedProjects(user.id) });
});

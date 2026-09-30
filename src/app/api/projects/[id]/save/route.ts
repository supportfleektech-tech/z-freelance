import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { setProjectSaved } from "@/server/services/saved-projects.service";

export const dynamic = "force-dynamic";

/** POST /api/projects/:id/save — bookmark an open project (idempotent). */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "projects:save");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireRole("FREELANCER");
    return ok(await setProjectSaved(user.id, id, true));
  },
);

/** DELETE /api/projects/:id/save — remove the bookmark. */
export const DELETE = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "projects:save");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireRole("FREELANCER");
    return ok(await setProjectSaved(user.id, id, false));
  },
);

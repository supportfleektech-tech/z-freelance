import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { getThread } from "@/server/services/messaging.service";

export const dynamic = "force-dynamic";

/** GET /api/threads/:id — full history; marks the caller's messages read. */
export const GET = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "threads:read");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();

    return ok(await getThread(user.id, id));
  },
);

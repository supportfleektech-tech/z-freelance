import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { transitionProject } from "@/server/services/project.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["PUBLISH", "CLOSE", "CANCEL"]) }).strict();

/** POST /api/projects/:id/transition — publish, close or cancel. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "projects:transition");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const { action } = await parseBody(request, bodySchema);

    return ok({ project: await transitionProject(id, user.id, action) });
  },
);

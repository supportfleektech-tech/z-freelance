import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, submitWorkSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { submitWork } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** POST /api/milestones/:id/submit — freelancer marks the work delivered. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "milestones:submit");

    const { id } = await parseParams(context.params, idParamSchema);
    const freelancer = await requireUser();
    const { submissionNote, attachmentIds } = await parseBody(request, submitWorkSchema);

    return ok({
      milestone: await submitWork(id, freelancer.id, submissionNote, attachmentIds),
    });
  },
);

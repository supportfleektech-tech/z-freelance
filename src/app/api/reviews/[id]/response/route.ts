import type { NextRequest } from "next/server";
import { noContent, ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, reviewResponseSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { deleteReviewResponse, respondToReview } from "@/server/services/review.service";

export const dynamic = "force-dynamic";

/** PUT /api/reviews/:id/response — the review subject's one public reply. */
export const PUT = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "reviews:respond");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const { text } = await parseBody(request, reviewResponseSchema);
    return ok({ review: await respondToReview(user.id, id, text) });
  },
);

/** DELETE /api/reviews/:id/response — retract the reply. */
export const DELETE = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "reviews:respond");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    await deleteReviewResponse(user.id, id);
    return noContent();
  },
);

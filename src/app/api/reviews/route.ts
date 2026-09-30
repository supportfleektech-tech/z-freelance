import type { NextRequest } from "next/server";
import { created, ok, parseBody, route, throttle } from "@/lib/api/http";
import { createReviewSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { createReview, listReviewsForUser } from "@/server/services/review.service";

export const dynamic = "force-dynamic";

/**
 * GET  /api/reviews — reviews the caller has received.
 * POST /api/reviews — review the other party on a completed contract.
 */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "reviews:list");

  const user = await requireUser();
  return ok({ reviews: await listReviewsForUser(user.id) });
});

export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "reviews:create");

  const user = await requireUser();
  const input = await parseBody(request, createReviewSchema);

  return created(await createReview(user.id, input));
});

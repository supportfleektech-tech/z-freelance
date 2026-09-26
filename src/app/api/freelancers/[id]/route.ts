import type { NextRequest } from "next/server";
import { ApiError, ok, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import {
  getFreelancerPublicProfile,
  listFreelancerWork,
} from "@/server/services/freelancer.service";

export const dynamic = "force-dynamic";

/** GET /api/freelancers/:id — public profile, reviews and recent work. */
export const GET = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "freelancers:read");

    const { id } = await parseParams(context.params, idParamSchema);
    const profile = await getFreelancerPublicProfile(id);
    if (!profile) throw ApiError.notFound("Freelancer not found.");

    return ok({ profile, work: await listFreelancerWork(profile.userId) });
  },
);

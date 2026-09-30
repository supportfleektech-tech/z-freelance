import type { NextRequest } from "next/server";
import { ok, parseBody, route, throttle, ApiError } from "@/lib/api/http";
import { updateClientProfileSchema, updateFreelancerProfileSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { updateClientProfile, updateFreelancerProfile } from "@/server/services/account.service";

export const dynamic = "force-dynamic";

/** PATCH /api/me/profile — update the caller's role-specific profile. */
export const PATCH = route(async (request: NextRequest) => {
  throttle(request, "api", "profile:update");

  const user = await requireUser();

  if (user.role === "FREELANCER") {
    const input = await parseBody(request, updateFreelancerProfileSchema);
    return ok({ profile: await updateFreelancerProfile(user.id, input) });
  }

  if (user.role === "CLIENT") {
    const input = await parseBody(request, updateClientProfileSchema);
    return ok({ profile: await updateClientProfile(user.id, input) });
  }

  throw ApiError.badRequest("Admin accounts do not have a marketplace profile.");
});

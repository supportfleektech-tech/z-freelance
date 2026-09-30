import type { NextRequest } from "next/server";
import { ok, parseQuery, route, throttle } from "@/lib/api/http";
import { freelancerQuerySchema } from "@/lib/validation";
import { searchFreelancers } from "@/server/services/freelancer.service";

export const dynamic = "force-dynamic";

/** GET /api/freelancers — public directory search. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "freelancers:search");

  const query = parseQuery(request, freelancerQuerySchema);
  return ok(await searchFreelancers(query));
});

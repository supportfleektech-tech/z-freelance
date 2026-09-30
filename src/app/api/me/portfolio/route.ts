import type { NextRequest } from "next/server";
import { created, ok, parseBody, route, throttle } from "@/lib/api/http";
import { createPortfolioItemSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { createPortfolioItem, listPortfolioItems } from "@/server/services/portfolio.service";

export const dynamic = "force-dynamic";

/** GET /api/me/portfolio — the caller's portfolio items (freelancers). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ items: await listPortfolioItems(user.id) });
});

/** POST /api/me/portfolio — add a portfolio item (max 20 per freelancer). */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "portfolio:create");

  const user = await requireUser();
  const input = await parseBody(request, createPortfolioItemSchema);
  return created({ item: await createPortfolioItem(user.id, input) });
});

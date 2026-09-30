import type { NextRequest } from "next/server";
import { noContent, ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, updatePortfolioItemSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { deletePortfolioItem, updatePortfolioItem } from "@/server/services/portfolio.service";

export const dynamic = "force-dynamic";

/** PATCH /api/me/portfolio/:id — edit one of the caller's portfolio items. */
export const PATCH = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "portfolio:update");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    const input = await parseBody(request, updatePortfolioItemSchema);
    return ok({ item: await updatePortfolioItem(user.id, id, input) });
  },
);

/** DELETE /api/me/portfolio/:id */
export const DELETE = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "portfolio:delete");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    await deletePortfolioItem(user.id, id);
    return noContent();
  },
);

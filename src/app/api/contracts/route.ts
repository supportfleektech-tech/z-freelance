import type { NextRequest } from "next/server";
import { ok, route, throttle } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/guards";
import { listContractsForUser } from "@/server/services/contract.service";

export const dynamic = "force-dynamic";

/** GET /api/contracts — every contract the caller is a party to. */
export const GET = route(async (request: NextRequest) => {
  throttle(request, "api", "contracts:list");

  const user = await requireUser();
  return ok({ contracts: await listContractsForUser(user.id) });
});

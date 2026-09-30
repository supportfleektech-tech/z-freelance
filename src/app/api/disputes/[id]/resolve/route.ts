import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema, resolveDisputeSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { resolveDispute } from "@/server/services/contract.service";
import { writeAuditLog } from "@/server/services/admin.service";
import { getClientIp } from "@/lib/api/http";

export const dynamic = "force-dynamic";

/** POST /api/disputes/:id/resolve — admin decides where escrowed money goes. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "strict", "disputes:resolve");

    const { id } = await parseParams(context.params, idParamSchema);
    const admin = await requireRole("ADMIN");
    const input = await parseBody(request, resolveDisputeSchema);

    await resolveDispute(id, admin.id, input);
    await writeAuditLog({
      actorId: admin.id,
      action: `dispute.${input.outcome.toLowerCase()}`,
      entityType: "dispute",
      entityId: id,
      meta: { outcome: input.outcome },
      ipAddress: getClientIp(request),
    });

    return ok({ resolved: true });
  },
);

import type { NextRequest } from "next/server";
import { ok, parseParams, route, throttle, getClientIp } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { markPayoutPaid } from "@/server/services/contract.service";
import { writeAuditLog } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** POST /api/admin/payouts/:id/pay — mark a withdrawal as transferred. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "strict", "admin:payouts:pay");

    const { id } = await parseParams(context.params, idParamSchema);
    const admin = await requireRole("ADMIN");

    await markPayoutPaid(id, admin.id);
    await writeAuditLog({
      actorId: admin.id,
      action: "payout.paid",
      entityType: "payout",
      entityId: id,
      ipAddress: getClientIp(request),
    });

    return ok({ paid: true });
  },
);

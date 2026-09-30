import type { NextRequest } from "next/server";
import { ok, parseBody, parseParams, route, throttle, getClientIp } from "@/lib/api/http";
import { idParamSchema, updateUserStatusSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth/guards";
import { setUserStatus } from "@/server/services/account.service";
import { writeAuditLog } from "@/server/services/admin.service";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/users/:id/status — suspend or reinstate an account. */
export const PATCH = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "strict", "admin:users:status");

    const { id } = await parseParams(context.params, idParamSchema);
    const admin = await requireRole("ADMIN");
    const input = await parseBody(request, updateUserStatusSchema);

    const user = await setUserStatus(admin.id, id, input.status, input.reason);
    await writeAuditLog({
      actorId: admin.id,
      action: `user.${input.status.toLowerCase()}`,
      entityType: "user",
      entityId: id,
      meta: { reason: input.reason ?? null },
      ipAddress: getClientIp(request),
    });

    return ok({ user: { id: user.id, status: user.status } });
  },
);

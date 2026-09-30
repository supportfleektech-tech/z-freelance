import type { NextRequest } from "next/server";
import { ok, parseBody, route, throttle } from "@/lib/api/http";
import { changePasswordSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { changePassword } from "@/server/services/account.service";

export const dynamic = "force-dynamic";

/** POST /api/auth/password — change the caller's own password. */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "auth", "password");

  const user = await requireUser();
  const input = await parseBody(request, changePasswordSchema);
  await changePassword(user.id, input.currentPassword, input.newPassword);

  return ok({ updated: true });
});

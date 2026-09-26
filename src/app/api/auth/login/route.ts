import type { NextRequest } from "next/server";
import { ok, parseBody, route, throttle } from "@/lib/api/http";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/services/account.service";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Rate-limited per IP and returns the same message for "unknown email" and
 * "wrong password" so the endpoint cannot enumerate accounts.
 */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "auth", "login");

  const { email, password } = await parseBody(request, loginSchema);
  const user = await authenticate(email, password);

  const token = await createSessionToken(user.id, user.role);
  await setSessionCookie(token);

  return ok({ id: user.id, email: user.email, name: user.name, role: user.role });
});

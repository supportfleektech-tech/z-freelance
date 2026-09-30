import type { NextRequest } from "next/server";
import { created, parseBody, route, throttle } from "@/lib/api/http";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/server/services/account.service";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 *
 * Creates the account (plus its role profile and wallet, in one transaction)
 * and signs the caller straight in — a second "please log in now" step would
 * only cost us sign-ups.
 */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "auth", "register");

  const input = await parseBody(request, registerSchema);
  const user = await registerUser(input);

  const token = await createSessionToken(user.id, user.role);
  await setSessionCookie(token);

  return created(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    "/api/auth/me",
  );
});

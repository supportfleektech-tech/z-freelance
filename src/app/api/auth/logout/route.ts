import { noContent, route } from "@/lib/api/http";
import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — clears the session cookie. */
export const POST = route(async () => {
  await clearSessionCookie();
  return noContent();
});

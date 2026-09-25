import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";
import type { UserRole } from "../db/schema";

/**
 * Stateless session tokens.
 *
 * A signed JWT is stored in an httpOnly, SameSite=Lax cookie. The payload is
 * intentionally tiny (subject + role) — authorisation decisions are always
 * re-checked against the database, so suspending a user takes effect on their
 * next request even though the token itself is still valid.
 */
export interface SessionPayload {
  sub: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function createSessionToken(userId: string, role: UserRole): Promise<string> {
  const ttl = env().SESSION_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .setIssuer("z-freelance")
    .setAudience("z-freelance-web")
    .sign(secretKey());
}

/** Verify signature + expiry. Returns null for any invalid/expired token. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "z-freelance",
      audience: "z-freelance-web",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      sub: payload.sub,
      role: (payload.role as UserRole) ?? "CLIENT",
      jti: typeof payload.jti === "string" ? payload.jti : "",
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

/** Read the session cookie inside a Server Component / Route Handler. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(env().SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(env().SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: env().SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(env().SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Cookie serialiser for Route Handlers (which cannot use next/headers' setter). */
export function sessionCookieHeader(token: string | null): string {
  const e = env();
  const parts = [
    `${e.SESSION_COOKIE}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? e.SESSION_TTL_SECONDS : 0}`,
  ];
  if (e.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

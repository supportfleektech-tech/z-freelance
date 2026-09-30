import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { rateLimit } from "../auth/rate-limit";
import { config } from "../config";

/**
 * HTTP layer: one response envelope, one error type, one wrapper.
 *
 * Success: `{ ok: true, data }`
 * Failure: `{ ok: false, error: { code, message, issues? } }`
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: string; message: string }>;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "Invalid request.", details?: unknown): ApiError {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Authentication required."): ApiError {
    return new ApiError(401, "unauthenticated", message);
  }
  static forbidden(message = "You do not have access to this resource."): ApiError {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Not found."): ApiError {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message = "That conflicts with existing data."): ApiError {
    return new ApiError(409, "conflict", message);
  }
  static unprocessable(
    message = "The request could not be processed.",
    details?: unknown,
  ): ApiError {
    return new ApiError(422, "unprocessable", message, details);
  }
  static tooMany(message = "Too many requests."): ApiError {
    return new ApiError(429, "rate_limited", message);
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T, location?: string): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { ok: true, data },
    { status: 201, headers: location ? { Location: location } : undefined },
  );
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(error: ApiError): NextResponse<ApiFailure> {
  const body: ApiFailure = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (error.details !== undefined) {
    body.error.issues = error.details as ApiFailure["error"]["issues"];
  }
  return NextResponse.json(body, { status: error.status });
}

function zodErrorToApiError(error: ZodError): ApiError {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
  return new ApiError(422, "validation_failed", "The submitted data is not valid.", issues);
}

/**
 * Wrap a Route Handler so thrown `ApiError`s, Zod failures and unexpected
 * exceptions all become the same JSON envelope — and never leak a stack trace
 * or a raw database error to the client.
 */
export function route<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      const result = await handler(...args);
      if (result instanceof NextResponse) return result;
      return NextResponse.json({ ok: true, data: result ?? null });
    } catch (error) {
      if (error instanceof ApiError) return fail(error);
      if (error instanceof ZodError) return fail(zodErrorToApiError(error));

      // Unique-constraint violations are the most common "expected" database
      // failure; translate them instead of returning an opaque 500.
      if (isUniqueViolation(error)) {
        return fail(ApiError.conflict("That record already exists."));
      }

      console.error("[api] unhandled error", error);
      return fail(
        new ApiError(500, "internal_error", "Something went wrong on our side. Please retry."),
      );
    }
  };
}

/**
 * Postgres SQLSTATE 23505 (unique_violation).
 *
 * ORMs wrap driver errors (e.g. DrizzleQueryError → PGlite/pg error), so the
 * code may live a level or two down the `cause` chain.
 */
export function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (depth > 4 || typeof error !== "object" || error === null) return false;
  if ((error as { code?: string }).code === "23505") return true;
  return isUniqueViolation((error as { cause?: unknown }).cause, depth + 1);
}

/** Parse and validate a JSON body against a Zod schema. */
export async function parseBody<S extends ZodTypeAny>(
  request: NextRequest | Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw ApiError.badRequest("Expected a JSON request body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw zodErrorToApiError(parsed.error);
  return parsed.data;
}

/** Parse and validate URL search params. */
export function parseQuery<S extends ZodTypeAny>(
  request: NextRequest | Request,
  schema: S,
): z.infer<S> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw zodErrorToApiError(parsed.error);
  return parsed.data;
}

/** Parse and validate route params (Next 15 passes these as a Promise). */
export async function parseParams<S extends ZodTypeAny>(
  params: unknown,
  schema: S,
): Promise<z.infer<S>> {
  const resolved = await Promise.resolve(params);
  const parsed = schema.safeParse(resolved);
  if (!parsed.success) throw zodErrorToApiError(parsed.error);
  return parsed.data;
}

/** Apply a rate limit bucket, throwing 429 when exhausted. */
export function throttle(
  request: NextRequest | Request,
  bucket: keyof typeof config.rateLimits | "strict",
  keySuffix = "",
): void {
  const limit = bucket === "strict" ? config.rateLimits.auth : config.rateLimits.api;
  const result = rateLimit(`${bucket}:${getClientIp(request)}:${keySuffix}`, limit);
  if (!result.ok) throw ApiError.tooMany("Too many requests — please slow down.");
}

/** Best-effort client IP, honouring proxy headers set by the platform. */
export function getClientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Reject a value as an ownership violation. */
export function assertOwnership(actual: string, expected: string, label = "resource"): void {
  if (actual !== expected) {
    throw ApiError.forbidden(`You do not own this ${label}.`);
  }
}

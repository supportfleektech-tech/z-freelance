"use client";

import type { ApiEnvelope } from "@/lib/api/http";

/**
 * Typed browser-side API client.
 *
 * Every route handler uses the same envelope, so one helper is enough to keep
 * error handling consistent across all client components.
 */
export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T }> {
  const response = await fetch(input, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON error (proxy 502, HTML error page...) — fall through to status handling.
  }

  if (!response.ok || !envelope || envelope.ok !== true) {
    const message =
      envelope && envelope.ok === false
        ? envelope.error.message
        : `Request failed (${response.status}).`;
    const issues = envelope && envelope.ok === false ? envelope.error.issues : undefined;
    const error = new Error(message) as Error & {
      status: number;
      issues?: Array<{ path: string; message: string }>;
    };
    error.status = response.status;
    error.issues = issues;
    throw error;
  }

  return { ok: true, data: envelope.data };
}

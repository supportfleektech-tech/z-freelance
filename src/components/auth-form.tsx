"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import { Alert } from "./ui";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "CLIENT" | "FREELANCER" | "ADMIN";
}

/** Login and registration share one form component with a mode switch. */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [role, setRole] = useState<"CLIENT" | "FREELANCER">("CLIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { data } = await fetchJson<SessionUser>(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "login" ? { email, password } : { name, email, password, role },
          ),
        },
      );
      const destination = data.role === "ADMIN" ? "/admin" : next;
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-bold text-ink-950">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {mode === "login"
          ? "Sign in to continue to your workspace."
          : "Free to join. Only pay a fee when escrow is released."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {mode === "register" ? (
          <>
            <div>
              <span className="label">I want to</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {(
                  [
                    { value: "CLIENT", title: "Hire freelancers", hint: "Post projects & escrow" },
                    { value: "FREELANCER", title: "Work as a freelancer", hint: "Bid & get paid" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={role === option.value}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      role === option.value
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink-900">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="name" className="label">
                Full name
              </label>
              <input
                id="name"
                className="input"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 10 : 1}
          />
          {mode === "register" ? (
            <p className="mt-1 text-xs text-ink-400">
              At least 10 characters with a letter and a number.
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending
            ? mode === "login"
              ? "Signing in…"
              : "Creating your account…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="link">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="link">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <main className="noise relative flex-1 overflow-hidden py-16">
      <div
        aria-hidden
        className="aurora-blob -left-24 top-0 h-96 w-96 animate-aurora bg-brand-200/60"
      />
      <div
        aria-hidden
        className="aurora-blob -right-24 bottom-0 h-96 w-96 animate-aurora bg-amber-200/50 [animation-delay:-7s]"
      />
      <div className="container-page relative">
        <Suspense fallback={<div className="card mx-auto h-96 w-full max-w-md animate-pulse" />}>
          <AuthForm mode="login" />
        </Suspense>
        <p className="mt-6 text-center text-xs text-ink-400">
          Demo accounts: <code>amara@northwind.io</code> (client) ·{" "}
          <code>sofia.freelance@example.com</code> (freelancer) · <code>admin@zfreelance.dev</code>{" "}
          (admin) — password <code>Password123!</code>
        </p>
      </div>
    </main>
  );
}

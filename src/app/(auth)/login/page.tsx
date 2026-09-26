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
    <main className="container-page py-16">
      <Suspense fallback={<div className="card mx-auto h-96 w-full max-w-md animate-pulse" />}>
        <AuthForm mode="login" />
      </Suspense>
      <p className="mt-6 text-center text-xs text-ink-400">
        Demo accounts: <code>amara@northwind.io</code> (client) ·{" "}
        <code>sofia.freelance@example.com</code> (freelancer) · <code>admin@zfreelance.dev</code>{" "}
        (admin) — password <code>Password123!</code>
      </p>
    </main>
  );
}

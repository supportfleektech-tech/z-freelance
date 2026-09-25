import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <main className="container-page py-16">
      <Suspense fallback={<div className="card mx-auto h-96 w-full max-w-md animate-pulse" />}>
        <AuthForm mode="register" />
      </Suspense>
    </main>
  );
}

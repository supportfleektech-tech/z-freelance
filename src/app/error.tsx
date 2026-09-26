"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-950">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        This is on our side, not yours. Try again — and if it keeps happening, the details are in
        our logs.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
      {error.digest ? <p className="mt-6 text-xs text-ink-400">Reference: {error.digest}</p> : null}
    </main>
  );
}

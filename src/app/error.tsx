"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCcw, Home, LifeBuoy } from "lucide-react";

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
    <main className="noise relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
      <div aria-hidden className="aurora-blob -left-20 top-10 h-72 w-72 bg-rose-200/60" />
      <div aria-hidden className="aurora-blob -right-16 bottom-0 h-72 w-72 bg-amber-200/60" />

      <div className="relative animate-pop-in">
        <div className="mx-auto flex h-20 w-20 animate-wiggle items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-pop [animation-iteration-count:3]">
          <LifeBuoy size={36} className="text-white" aria-hidden />
        </div>
        <h1 className="mt-8 font-display text-3xl font-black tracking-tight text-ink-950 sm:text-4xl">
          Something snapped on our side
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          Not your fault, and your money is untouched — escrow state lives in the ledger, not in
          this page. Try again; if it keeps happening, our logs already have the details.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => reset()}>
            <RefreshCcw size={16} />
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            <Home size={16} />
            Go home
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-8 inline-block rounded-full bg-ink-100 px-4 py-1.5 font-mono text-xs text-ink-500">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}

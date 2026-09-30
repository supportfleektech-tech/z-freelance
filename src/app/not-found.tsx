import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="noise relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
      <div
        aria-hidden
        className="aurora-blob -left-24 top-0 h-96 w-96 animate-aurora bg-brand-200/60"
      />
      <div
        aria-hidden
        className="aurora-blob -right-24 bottom-0 h-96 w-96 animate-aurora bg-amber-200/50 [animation-delay:-6s]"
      />
      <div
        aria-hidden
        className="grid-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />

      <div className="relative">
        <p className="font-display text-[6rem] font-black leading-none tracking-tighter sm:text-[9rem]">
          <span className="gradient-text">4</span>
          <span className="relative inline-block text-amber-400">
            0
            <Compass
              size={64}
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-slow text-amber-500/80"
            />
          </span>
          <span className="gradient-text">4</span>
        </p>
        <h1 className="mt-4 font-display text-2xl font-black tracking-tight text-ink-950 sm:text-3xl">
          This page took a wrong turn
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          The link may be old, or the page was moved. The marketplace, meanwhile, is very much alive
          — and money in escrow is exactly where you left it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/projects" className="btn-primary">
            Browse open projects
            <ArrowRight size={16} />
          </Link>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

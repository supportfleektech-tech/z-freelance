import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-950">That page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        The link may be old, or the page was removed. The marketplace, meanwhile, is very much
        alive.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/projects" className="btn-primary">
          Browse projects
        </Link>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </main>
  );
}

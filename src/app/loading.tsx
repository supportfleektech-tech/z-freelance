export default function Loading() {
  return (
    <main className="container-page py-16" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-ink-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card h-40 animate-pulse bg-ink-50" />
        ))}
      </div>
    </main>
  );
}

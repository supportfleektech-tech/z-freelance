import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";

export const metadata = { title: "Architecture" };
export const dynamic = "force-static";

/** Rendered version of docs/ARCHITECTURE.md so the reasoning is browsable in-app. */
export default function ArchitecturePage() {
  return (
    <main className="container-page max-w-4xl py-12">
      <PageHeader
        eyebrow="Engineering"
        title="Architecture"
        description="The decisions behind the system — what runs where, and why."
      />

      <div className="space-y-8 text-sm leading-7 text-ink-700">
        <Card>
          <CardHeader title="Stack" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "Next.js 15 (App Router)",
                "Server Components render data straight from the database; Client Components exist only where there is interactivity.",
              ],
              ["TypeScript — strict", "noUncheckedIndexedAccess on. No `any` in product code."],
              [
                "Drizzle ORM + Postgres",
                "Typed SQL. The same schema runs on real Postgres in production and on PGlite (Postgres compiled to WASM) in dev and CI.",
              ],
              [
                "Tailwind CSS",
                "Design tokens live in tailwind.config.ts; component classes in globals.css.",
              ],
              [
                "jose (JWT) + bcrypt",
                "Stateless sessions in httpOnly cookies; authorisation always re-checked against the DB row.",
              ],
              [
                "Vitest",
                "Unit tests for pure logic; one integration suite that drives the entire escrow state machine against a real database.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg bg-ink-50 p-4">
                <p className="font-semibold text-ink-900">{title}</p>
                <p className="mt-1 text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Layering" />
          <pre className="overflow-x-auto rounded-lg bg-ink-950 p-4 text-xs text-ink-100">
            {`app/                          ← framework surface (routes + pages)
  api/**/route.ts             ← thin: validate → call service → envelope
  **/page.tsx                 ← server components read services directly
components/                   ← UI; client components call the API
server/services/              ← ALL business rules, money moves, transactions
lib/                          ← framework-agnostic: db, auth, validation, money`}
          </pre>
          <p className="mt-3">
            The API layer contains no business logic, and the service layer knows nothing about
            HTTP. That is what makes the escrow engine testable without booting a server.
          </p>
        </Card>

        <Card>
          <CardHeader title="Why PGlite in development" />
          <p>
            This project ships with a working <Badge tone="green">real-Postgres-everywhere</Badge>{" "}
            story: production uses <code>DATABASE_URL</code>; development and CI use an embedded
            Postgres (PGlite). The same SQL migrations run against both. That removes the classic
            failure where tests pass against a stubbed database and explode against the real one —
            while still requiring zero infrastructure to clone and run.
          </p>
        </Card>

        <Card>
          <CardHeader title="Data model (18 tables)" />
          <p className="font-mono text-xs">
            users → freelancer_profiles / client_profiles → categories & skills → projects →
            proposals → contracts → milestones (escrow) → wallets / transactions (ledger) / payouts
            → threads / messages → reviews → notifications → disputes → audit_logs
          </p>
          <p className="mt-2">
            Constraints that make bad states impossible: unique proposal per (project, freelancer) ·
            check money &gt; 0 · check rating ∈ [1,5] · check wallet balance ≥ 0 · budget min ≤ max.
            Money is integer cents, never floats. Ratings are numeric(3,2), recomputed from the
            review table — never incremented by hand.
          </p>
        </Card>

        <Card>
          <CardHeader title="Security checklist" />
          <ul className="list-inside list-disc space-y-1">
            <li>
              bcrypt(12) password hashing; timing-safe login path (dummy hash on unknown email).
            </li>
            <li>
              Zod-validated inputs, server-side, at every API boundary; unknown keys rejected.
            </li>
            <li>Ownership checks in the service layer (not just in the UI).</li>
            <li>
              Suspension revokes access on the next request — sessions resolve against the DB row.
            </li>
            <li>Rate limiting on auth and money-moving routes.</li>
            <li>Security headers (CSP-friendly), httpOnly + SameSite=Lax cookies.</li>
            <li>Privileged admin actions are audit-logged with actor, action and IP.</li>
            <li>
              SQL injection impossible by construction — everything goes through Drizzle parameters.
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Deployment" />
          <p>
            Multi-stage Dockerfile produces a slim standalone image (~150 MB).{" "}
            <code>docker compose up</code> starts Postgres 16 + the app, applies migrations, and
            health-checks both. GitHub Actions runs typecheck, lint, unit tests, the escrow
            integration suite, a production build, and a live boot smoke test on every push.
          </p>
        </Card>
      </div>
    </main>
  );
}

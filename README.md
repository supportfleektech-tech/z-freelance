# z-freelance

**A freelance marketplace with milestone escrow — built end to end.**

Clients post projects. Freelancers submit proposals. Hiring creates a contract priced at the freelancer's bid, split into milestones. Each milestone is funded into **escrow**, the work is delivered, and approval **releases the money** — the 10% platform fee torn off, the rest landing in the freelancer's wallet. Disagreement freezes the funds behind an admin dispute workflow. Ratings, messaging, notifications and moderation close the loop.

## Why escrow matters here

The state machine below is not decorative — every transition is a transaction-guarded service function, and the money invariants are asserted in the test-suite against a real Postgres:

```
PENDING ──fund──▶ FUNDED ──submit──▶ SUBMITTED ──approve──▶ RELEASED
                  │                      │
                  └── open dispute ─◀────┘
                        │
                 DISPUTED ──resolve(ADMIN)──▶ RELEASED (to freelancer)
                        └──────────────▶ REFUNDED (to client)
```

**Invariants (tested):**
`Σ milestones = contract value` · `deposits = released + fees + refunds + still-in-escrow` · `fee = ⌊amount × bps ÷ 10,000⌋` (rounding favours the freelancer) · `wallet balance = Σ ledger credits − debits` · every release is one DB transaction: milestone flip + fee & payout ledger rows + wallet credit.

## Stack

| Layer      | Choice                           | Reason                                                                                                                                     |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | **Next.js 15 App Router**        | Server Components read from the DB directly; client components only exist where there's interactivity                                      |
| Language   | **TypeScript, strict**           | `noUncheckedIndexedAccess` on; no `any` in product code                                                                                    |
| Database   | **Postgres via Drizzle ORM**     | Typed SQL, real migrations. Runs on **real Postgres** (`DATABASE_URL`) or **PGlite** (Postgres in WASM) locally/CI — same schema, same SQL |
| Auth       | **bcrypt + JWT (jose)**          | httpOnly cookie sessions; authorisation re-checked against the DB row on every request so suspension is instant                            |
| Validation | **Zod (strict)**                 | Shared schemas for API + UI; unknown keys rejected                                                                                         |
| UI         | **Tailwind CSS**                 | Design tokens in `tailwind.config.ts`, component classes in `globals.css`                                                                  |
| Tests      | **Vitest**                       | 55 unit tests + 15-test integration suite driving the whole escrow flow against real Postgres                                              |
| Deploy     | **Docker multi-stage + Compose** | ~200MB image, Postgres 16 service, entrypoint auto-migrates, health checks                                                                 |

## The domain model (21 tables)

`users → freelancer_profiles / client_profiles` · `categories ← skills` · `projects ← project_skills` · `proposals` (unique per freelancer×project) · `contracts` (fee frozen at hire time) · `milestones` (escrow state machine) · `wallets / transactions (immutable ledger) / payouts` · `threads / messages` · `reviews` (two-sided, aggregates recomputed never incremented, one public response each) · `notifications / disputes / audit_logs` · `attachments` (file metadata + auth, bytes on disk) · `portfolio_items` (freelancer storefront) · `saved_projects` (private bookmarks).

Constraints that make bad states impossible: check `amount > 0`, check `rating ∈ [1,5]`, check `wallet ≥ 0`, check `budget_min ≤ budget_max`, one contract per proposal, one review per party per contract.

## Quickstart (local, zero infrastructure)

Requires Node 20.11+. No Postgres needed — development runs against embedded PGlite.

```bash
git clone https://github.com/supportfleektech-tech/z-freelance.git
cd z-freelance
npm ci
cp .env.example .env.local          # all values have dev defaults
npm run db:setup                    # migrate + seed demo data
npm run dev                         # http://localhost:3000
```

**Demo accounts** (password `Password123!`):

| Role       | Email                         | What you'll see                                            |
| ---------- | ----------------------------- | ---------------------------------------------------------- |
| Client     | `amara@northwind.io`          | A completed $10,500 contract, reviews, proposals to triage |
| Client     | `priya@lumenhealth.org`       | Live escrow: one milestone fundable/approvable right now   |
| Freelancer | `sofia.freelance@example.com` | $9,450 in-wallet from released escrow; request a payout    |
| Freelancer | `hana.freelance@example.com`  | Delivery awaiting client review — funds locked in escrow   |
| Admin      | `admin@zfreelance.dev`        | Platform KPIs, dispute queue, payout ops, user moderation  |

**Try the core flow in 2 minutes:** sign in as `priya@lumenhealth.org` → open the dispute-free contract in dashboard → approve the submitted milestone → sign in as `hana.freelance@example.com` → see the wallet credit + ledger entries.

## Docker (production topology locally)

```bash
docker compose up --build
# app: http://localhost:3000  — entrypoint migrates, then serves
# seed from the host:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zfreelance npm run db:seed
```

- `db` — Postgres 16, named volume, healthcheck
- `app` — standalone Next.js image, runs as non-root, auto-migrates on boot, HTTP healthcheck on `/api/health`

Build the image alone: `docker build -t z-freelance:local . && docker run -p 3000:3000 z-freelance:local` (runs embedded PGlite without the db service, since `DATABASE_URL` is unset).

## Verification

```bash
npm run check        # typecheck + lint + tests + production build
npm run test         # 107 tests: unit + real-DB integration suite
npm run uploads:gc   # sweep abandoned uploads older than 24h (GC_MAX_AGE_HOURS to tune) — cron it in prod
```

CI (`.github/workflows/ci.yml`) runs on every push: typecheck → lint → tests → production build → **boot the built server** → seed → smoke-test health, landing, marketplace API and a real seeded login. A third job builds the Docker image.

## API

All routes share one envelope — `{ ok: true, data }` or `{ ok: false, error: { code, message, issues? } }` — and one error type, so every client and tests share a predictable contract.

Auth (cookie session, rate-limited): `POST /api/auth/register · login · logout · /api/auth/me · /api/auth/password`
Marketplace: `GET/POST /api/projects · GET/PATCH /api/projects/:id · /transition · GET/POST /api/projects/:id/proposals`
Proposals: `POST /api/proposals/:id/decision (SHORTLIST|REJECT|HIRE) · /withdraw`
Contracts & escrow: `GET /api/contracts·/:id · /milestones (plan/add) · /cancel · /disputes` · `POST /api/milestones/:id/(fund|submit|approve)`
Money: `GET /api/wallet · POST /api/payouts · GET/POST /api/reviews · PUT/DELETE /api/reviews/:id/response`
Social: `GET/POST /api/threads · GET /api/threads/:id · POST /api/threads/:id/messages` · `GET /api/notifications · POST /api/notifications/read` · `GET/PATCH /api/me/notification-prefs`
Files: `POST /api/uploads (multipart, context=MESSAGE|MILESTONE|PORTFOLIO) · GET/DELETE /api/files/:id` — bytes on disk, authorization in Postgres (thread participants / contract parties; portfolio imagery public)
Freelancer depth: `GET/POST /api/me/portfolio · PATCH/DELETE /api/me/portfolio/:id` · `POST/DELETE /api/projects/:id/save · GET /api/me/saved-projects`
Directory: `GET /api/freelancers·/:id · GET /api/categories · PATCH /api/me/profile`
Admin: `GET /api/admin/stats·/users·/disputes·/payouts · PATCH /api/admin/users/:id/status · POST /api/disputes/:id/resolve · POST /api/admin/payouts/:id/pay · POST /api/admin/categories`
Ops: `GET /api/health` (reports driver: `postgres` | `pglite`, db latency)

## Configuration

Everything is validated at boot (`src/lib/env.ts`) and documented in `.env.example`. Highlights:

| Variable           | Default                     | Purpose                                         |
| ------------------ | --------------------------- | ----------------------------------------------- |
| `DATABASE_URL`     | _(unset → embedded PGlite)_ | Real Postgres connection string                 |
| `PGLITE_DATA_DIR`  | `.pgdata`                   | Embedded Postgres location                      |
| `SESSION_SECRET`   | dev-only                    | **Required in production** — signs JWT sessions |
| `PLATFORM_FEE_BPS` | `1000`                      | Platform take rate in basis points (10%)        |
| `PASSWORD_ROUNDS`  | `12`                        | bcrypt cost                                     |
| `MIN_BID_CENTS`    | `500`                       | Minimum proposal bid                            |
| `UPLOAD_DIR`       | `.uploads`                  | Disk root for user files (absolute in prod)     |
| `UPLOAD_MAX_BYTES` | `10485760`                  | Files above this are rejected (10 MiB default)  |

## Repository layout

```
src/app                 ← routes & pages (App Router)
src/app/api/**/route.ts ← thin HTTP: validate → service → envelope
src/components          ← UI (client components only where there is interactivity)
src/server/services     ← ALL business rules + money movement + transactions
src/lib                 ← db client, auth, validation, money, env, utils (framework-agnostic)
drizzle                 ← SQL migrations generated from src/lib/db/schema.ts
scripts                 ← migrate.mjs + gc-uploads.mjs (prod-safe JS) + seed.ts (demo data via real services)
tests                   ← unit/ + integration/ (escrow state machine on real Postgres)
docs                    ← ARCHITECTURE.md (also rendered in-app at /docs/architecture)
```

## Honest boundaries (what's simulated)

This is a self-contained system, so two integrations are intentionally simulated behind clean seams:

- **Escrow "deposits"** record client intent and lock money in the ledger (`ESCROW_DEPOSIT` with a unique `escrow_reference`) — no card network is involved. The seam is `fundMilestone()` in `src/server/services/contract.service.ts`; a payment-intent adapter drops in without touching callers.
- **Payouts** are a request → finance-team approval workflow (`REQUESTED → PAID`) rather than bank transfers; approve in **Admin → Payouts**.
- **Uploads** are durable, content-sniffed (magic bytes must match the declared type) and authorized, but not virus-scanned — a production deployment would add a scanning step (and likely an object-storage adapter) at the `storage.service.ts` seam.

Everything else — auth, escrow state machine, fee math, wallets, ledger, disputes, reviews (with public responses), messaging (with file attachments), notifications (with per-type opt-outs), portfolios, bookmarks, moderation, audit trail — is fully implemented and exercised by the test suite.

## Links inside the app

- `/docs` — the product workflow explained to humans
- `/docs/architecture` — this engineering story rendered in-app
- `/api/health` — ready for any load balancer

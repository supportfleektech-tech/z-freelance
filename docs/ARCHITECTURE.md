# Architecture — z-freelance

This document records the engineering decisions: what runs where, why, and the tradeoffs that were
chosen deliberately. It is also rendered in-app at `/docs/architecture`.

## 1. System overview

```
┌────────────────────────────────────────────────────────────────┐
│                        client (browser)                          │
│   server-rendered pages     +      client components (forms,      │
│   (read path, via services) │      write path, via HTTP API)      │
├─────────────────────────────┼──────────────────────────────────────┤
│                     Next.js 15 (App Router)                        │
│                                                                    │
│  app/**/page.tsx        app/api/**/route.ts                        │
│  server components  →   └──► validate (Zod) → service → envelope   │
│  read services directly ──┘                                        │
│                        server/services/*                           │
│        business rules · state machines · transactions · NOTIFY     │
│                                                                    │
│                        lib/* (framework-agnostic)                  │
│            db client · auth · validation · money · env             │
├────────────────────────────────────────────────────────────────────┤
│   Drizzle ORM  ─ 18 tables  ─  Postgres (prod) | PGlite (dev/CI)   │
└────────────────────────────────────────────────────────────────────┘
```

Two flows touch the same service layer:

- **Read path** — server components call services directly. No HTTP hop, no serialization
  of models that the DB can stay authoritative about.
- **Write path** — client components call the REST API, which is deliberately _thin_: parse +
  validate → call the same services → return the standard envelope.

If a rule only exists in one of these two paths, it's a bug. That rule lives in services.

## 2. Decisions

### 2.1 One schema, two interchangeable drivers

| Environment      | Driver                                 | How                  |
| ---------------- | -------------------------------------- | -------------------- |
| Production       | `node-postgres` (`pg`, pool)           | `DATABASE_URL` set   |
| Dev / CI / tests | **PGlite** (Postgres compiled to WASM) | `DATABASE_URL` unset |

Why: it kills "works against the mock, dies against the real thing". The integration tests run the
production SQL migrations against a real database engine and then push the entire escrow state
machine through it — on every CI run, with no service containers. `GET /api/health` reports which
driver is live so operators can tell at a glance.

Tradeoff: two code paths for pooling (pg Pool vs embedded single connection). Encapsulated in
`src/lib/db/index.ts`; nothing else knows the driver exists.

### 2.2 Layered, with the rule "HTTP never owns business logic"

```
app/api → validate input, resolve auth, translate errors to the envelope
server/services → every rule, every state transition, every transaction
```

The same functions are callable from pages, route handlers, the seed script, and the test suite.
That's why the seed doubles as a smoke test: `npm run db:seed` drives register → hire → escrow →
release → review through production code.

### 2.3 The escrow state machine

Milestones have five states and six legal operations. Every operation is a service function that:

1. asserts the caller's role AND party membership (not just "is logged in"),
2. asserts the current state (conditional `UPDATE ... WHERE status = 'X'` → 409 on race),
3. writes rows and ledger entries **in one database transaction**,
4. issues notifications in the same transaction.

There is no background "reconciler". The system of record is the milestone row plus the immutable
`transactions` ledger; the wallet is a cached projection that tests prove equals `ledger − payouts`.

```
PENDING → FUNDED → SUBMITTED → RELEASED      (happy path)
FUNDED/SUBMITTED → DISPUTED → RELEASED | REFUNDED   (dispute path, admin-decided)
```

**Dispute resolution moves real money atomically**: refund credits the client's wallet (visible in
their ledger, withdrawable), release credits the freelancer's wallet minus the frozen fee.

### 2.4 Money as integer cents

- All DB columns: `bigint` cents. All API inputs: `*Cents`. All UI: formats through `formatMoney`.
- Fee: `⌊amount × bps ÷ 10 000⌋`; payout = `amount − fee`. Rounding favours the freelancer; fee +
  payout always sums to the amount — property-tested across the whole input space used by the app.
- Milestone plans **must total the contract value exactly**; unfunded plans can be replaced, funded
  plans can only grow. Escrow is balanced by construction.

### 2.5 Ratings recomputed, never incremented

`ratingAvg`/`ratingCount` on profiles are recomputed from the `reviews` table in the same
transaction that inserts the review (`ROUND(AVG(), 2)`). There is no code path that mutates a rating
directly, which means it cannot drift.

### 2.6 Auth: cheap tokens, expensive authorization

- Session = signed JWT (HS256, jose) in an `httpOnly + SameSite=Lax` cookie, containing only
  `sub + role + jti + iat/exp`.
- Every request that needs a user re-validates against the DB row (memoised per-request) —
  **suspension and deletion revoke access on the next request**, not at token expiry.
- bcrypt cost 12 (4 in tests), constant-work dummy hash when the email is unknown (no enumeration),
  rate-limited auth endpoints.

### 2.7 Authorization checks live in services

Examples: `mustOwnProject`, `loadContractFor(tx, ..., role)`, party checks in `getThread` /
`sendMessage` / `createReview`, `requireRole("ADMIN")` for moderation. UI hides buttons as a
courtesy; services enforce them as law.

### 2.8 Files: bytes on disk, trust in Postgres

User files (message attachments, escrow deliverables, portfolio imagery) are stored as
server-named blobs under `UPLOAD_DIR` (`uuid.ext` — **user input never becomes a path**),
with metadata and authorization in the `attachments` table. Uploads start _unlinked_ and are
bound to exactly one message or milestone inside the same transaction as the post they belong
to, so a rejected attach rolls the post back and a file can never dangle onto someone else's
content. Download goes through `assertCanView`: uploader + admin always; thread participants
for message files; contract parties for milestone files; unlinked PORTFOLIO imagery is public
by design (it renders on public profiles). The MIME allowlist is the single source of truth —
no HTML/SVG/executables — and the stored extension comes from the MIME type, never from the
client filename. This is deliberately not S3: the swap point is one service
(`storage.service.ts`) behind `storeUpload` / `readAuthorizedFile`.

### 2.9 Preferences are opt-out, stored as data

`users.notification_prefs` holds per-type `false` flags; a missing key means _enabled_. The
`notify()` fan-out batches one users-read per transaction and silently drops suppressed types —
callers never have to think about prefs.

## 3. Data model

Postgres enums for every state column (invalid states unrepresentable); check constraints for
money/rating bounds; unique indexes for `one proposal per freelancer×project`, `one contract per
proposal`, `one review per party×contract`, `wallet per user`, slug uniques. Migrations are
generated from the Drizzle schema (`npm run db:generate`) and replayed by `scripts/migrate.mjs`
(same script in local dev, CI, and the Docker entrypoint).

## 4. API design

- One envelope: `{ ok: true, data }` / `{ ok: false, error: { code, message, issues? } }`.
- One error type (`ApiError`) thrown from anywhere, translated by one `route()` wrapper. Zod errors
  become 422 with field paths. Unique violations (`SQLSTATE 23505`, walked down the cause chain)
  become 409. Everything else becomes a logged, sanitized 500.
- Input validation is strict (unknown keys rejected). Pagination is clamped (`max 50`).
- Rate limiting in-memory per process, tuned per bucket: `/auth/*` strict (20/min), api (300/min),
  money routes strict. Interface is Redis-swap-ready for multi-instance.

## 5. Security posture

- No secrets in the repo; `.env.example` documents everything; env is validated at boot with
  actionable messages.
- TLS is terminated upstream; session cookie is `Secure` outside dev.
- SQL injection: impossible by construction (parameterized Drizzle everywhere). XSS: React-escaped
  text; no `dangerouslySetInnerHTML`. CSRF: SameSite=Lax cookies + JSON bodies (no GET mutations).
- Security headers via `next.config.headers()`: nosniff, SAMEORIGIN frame, referrer policy,
  locked-down permissions policy.
- Admin actions (suspend user, resolve dispute, mark payout) write actor/action/ip into
  `audit_logs`.

## 6. Testing strategy

- **Unit (69)** — money math incl. the drift-sensitive float cases, slugify/URL normalisation,
  pagination clamps, zod schemas (policy messages, strict unknown-key rejection), password hashing &
  policy, JWT sign/verify/tamper, rate limiter windows, storage policy (MIME allowlist, filename
  sanitisation) and feature-pack schemas.
- **Integration (29)** — the whole marketplace: register → project → proposal → hire → plan →
  fund-guard races → submit-role races → release → finish → reviews + rating aggregates → payouts →
  dispute both ways → refunds → cancel guards → notification flow → **global money invariants over
  the entire database** (deposits = released + fees + refunds + held; admin KPI equals the
  milestone-derived escrow figure; every wallet equals its ledger); plus messaging authorization,
  thread anchoring regressions, and the feature pack: portfolio CRUD guards, saved-project privacy,
  notification opt-outs, review responses, and the file pipeline
  (store → link → authorize-by-conversation, stranger denial, context and re-link rules).
- CI then boots the **built** server and smoke-tests it — deployment shape, not just source.

## 7. Deployment

Multi-stage Dockerfile (`deps → builder → runner`):

- `builder`: `npm ci` (dev deps) → `next build` (standalone output; `postbuild` copies static +
  public into `.next/standalone`).
- `runner`: production-only deps (for the migration runner), standalone server, SQL migrations,
  entrypoint. Runs as uid 1001, healthcheck on `/api/health`, `SERVER_URL`/`DATABASE_URL` via env.
- `docker compose` adds Postgres 16 with a named volume and starts app only after `pg_isready`.

## 8. Known tradeoffs and the roadmap

| Decision now                              | When to revisit                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| In-process rate limiting                  | multi-instance deployment → Redis `INCR+EXPIRE` (same call-site)               |
| Polling notifications (30s)               | high-frequency ops → SSE or WS gateway                                         |
| Simulated payment acceptance/payout rails | add a payments adapter behind `fundMilestone`/`markPayoutPaid`                 |
| Single workspace thread reuse heuristic   | high message volume → explicit thread-per-contract                             |
| Deletion via FK cascades                  | strong privacy needs → retention/anonymisation jobs                            |
| PGlite for dev                            | team needs seeded staging data parity → shared staging Postgres (swap env var) |

The seams for each of these were deliberately left clean; none requires a reshaping rewrite.

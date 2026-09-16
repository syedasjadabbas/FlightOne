# Development Guide — FlightOne AI Travel Operating System (AI-TOS)

This guide is **mandatory**. Read it before writing any code in this repo or the server
repo. It encodes the agreed architecture, folder conventions, and performance rules.
It follows the same pattern as the sister ERP guide (`accounts-client/docs/DEVELOPMENT_GUIDE.md`)
— read that one too if you are working across both platforms; conventions are kept
identical on purpose so engineers can move between codebases without relearning rules.

> **Status note:** this repo (`flight-one`) is currently a bare `create-next-app` scaffold.
> There is no `flight-one-server` yet. Section 6/7 describe the server this platform will
> need, assumed to follow the same Node + Prisma + shared-Postgres pattern already proven in
> `crm-server`/`accounts-client`, since it's the same infra and team. **Treat this as a
> proposal, not fact** — confirm with whoever owns infra decisions before provisioning a new
> database/service, and update this section once the real repo exists.

---

## 0. Stack & ground rules

- **Client:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 (already scaffolded
  in `package.json` — do not downgrade).
  - ⚠️ **This is not the Next.js you know.** APIs/conventions differ from older versions.
    Read the relevant guide in `node_modules/next/dist/docs/` before using a framework
    feature, and heed deprecation notices (see `AGENTS.md`).
- **Client state:** [Zustand](https://github.com/pmndrs/zustand) for UI/app state.
- **Server state / data fetching:** **RTK Query** (Redux Toolkit) with response caching.
- **Auth gate:** root **`proxy.ts`** — Next.js 16 renamed the `middleware` file convention to
  `proxy` (same role: runs before routes render; Node.js runtime by default).
- **Server (proposed):** a modular Node API (`flight-one-api`) + background workers
  (`flight-one-workers`), Prisma over Postgres. Whether this is a brand-new managed Postgres
  instance or a schema on the existing shared DigitalOcean instance is an infra decision —
  make it explicit in this section once decided, and if it's shared, apply every rule in §6
  as-is (this is a customer-facing booking platform; DB contention will be felt immediately
  in checkout flows).
- **AI layer:** a dedicated conversation/orchestration service (Module 01) sits in front of
  the booking engine — it is not a thin wrapper the Next.js server renders around; treat it
  as its own service with its own deploy lifecycle (see §9).
- **Design:** the Earth Odyssey design system (void/cream/slate/emerald tokens, Cormorant
  display + Figtree body + JetBrains Mono labels, glassmorphic dark stage) is documented in
  [`docs/design/`](./design/README.md) — that is the source of truth. Build client UI
  against its tokens and the shared `components/ui/` primitives; do not invent new colors,
  fonts, or one-off component chrome. `app/globals.css` remains the single place tokens are
  *defined*; `docs/design/` documents them and `components/ui/` consumes them.
- **Marketing content:** live FlightOne.co inventory (destinations, prices, FAQs, testimonials,
  WhatsApp CTAs) lives in [`lib/content/flightone.ts`](../lib/content/flightone.ts) with the
  stakeholder brief in [`docs/stakeholders/flightone-co-content-inventory.md`](./stakeholders/flightone-co-content-inventory.md).
  Prefer that module over hard-coded marketing strings on `/` and Ava chat.

---

## 1. Client architecture — colocation & code splitting

> **Rule:** Everything related to a single page lives inside that page's directory.
> The global scope holds **only** things genuinely shared by multiple pages.

This maximizes code-splitting (each route only ships what it needs) and keeps features
self-contained.

### 1.1 Per-page (colocated) structure

```
app/
  (traveller)/
    trips/
      page.tsx              # route entry — thin, composes feature pieces
      layout.tsx            # route layout (if needed)
      components/           # components used ONLY by /trips
        TripCard.tsx
        ItineraryTimeline.tsx
      hooks/                # hooks used ONLY by /trips
        useTripFilters.ts
      lib/                  # data layer for /trips (RTK Query slice, schemas)
        trips.api.ts
        trips.schema.ts
      store/                # zustand store scoped to /trips (if page-local state)
        trips.store.ts
      utils/                # pure helpers used ONLY by /trips
        formatItinerary.ts
      types.ts
```

- A component, hook, util, or store used by **one** page belongs **inside that page's
  directory** — never in a global folder.
- Promote to global **only** when a second page genuinely needs it (see §1.3).

### 1.2 What goes global

```
/
  proxy.ts                  # auth gate (see §3)
  store/                    # global zustand stores (auth/session, active profile, UI theme)
  lib/
    api/
      baseApi.ts            # single RTK Query createApi instance (shared tags/cache)
      store.ts              # redux store + middleware wiring
    auth/                   # token helpers, session utilities
  components/ui/            # design-system primitives reused everywhere (Button, Table…)
  hooks/                    # truly cross-page hooks (e.g. usePermission, useActiveProfile)
  utils/                    # cross-cutting pure helpers (money, dates, timezone/date math)
  types/                    # shared domain types (Money, Paginated<T>, TravellerProfile)
```

**Litmus test:** "Is this used by ≥2 routes?" → No: keep it colocated. Yes: move to global.

### 1.3 Component size limit

- **Components must not exceed 200–300 lines.** If one does, split it:
  - extract sub-components into the page's `components/`,
  - move logic into `hooks/`,
  - move pure helpers into `utils/`.
- Prefer many small, single-responsibility components over one large one. This matters more
  than usual here — chat/itinerary UIs accrete state fast.

---

## 2. Client state — Zustand

- Use Zustand for client/UI state that is **not** server data: active conversation thread,
  in-progress booking draft (before it's persisted), sidebar, multi-step form state
  (traveller details, seat selection), selected companions, theme.
- **Global stores** (in `/store`): `useAuthStore` (JWT tokens + user, persisted + cookie
  mirror), `useActiveProfileStore` (Corporate vs Personal — see Module 06), `useUiStore`.
  Permissions/entitlements are **server data** (RTK Query `/me/*`), not Zustand.
- **Page-local stores** live in the page's `store/` directory and are not imported elsewhere.
- Keep stores small and selector-driven; do not put server data (bookings, prices, supplier
  results) in Zustand — that is RTK Query's job (single source of truth, with
  caching/invalidation). This is especially important for prices: a stale Zustand copy of a
  fare is a customer-facing bug (charging the wrong amount).

---

## 3. Authentication — `proxy.ts` (Next 16's renamed middleware)

> Next.js 16 deprecated `middleware.ts` and renamed it to `proxy.ts`. Use `proxy.ts`; the
> codemod `npx @next/codemod@canary middleware-to-proxy .` migrates older code.

- **Auth model:** the API issues a JWT **access + refresh** token on `/auth/login`. Tokens
  live in `useAuthStore` (Zustand, persisted to localStorage) and are **mirrored to a
  readable cookie** so the proxy can gate routes. The access token is sent as a `Bearer`
  header; a 401 triggers a single `/auth/refresh` + retry, else logout.
- `proxy.ts`:
  - reads the access-token cookie and checks **JWT expiry** (`lib/auth/jwt.ts`),
  - redirects unauthenticated/expired users on protected routes to `/login?redirect=…`,
  - bounces authenticated users away from `/login`,
  - **does not gate the public marketing/search-preview surface** (if any exists) — only
    booking, profile, corporate, and vault routes require auth.
- **RBAC/entitlements** use `resource:action` permission keys from `/me/permissions`
  (`{ global, byCompany }` for corporate travellers — see Module 06). Check with
  `usePermissions().has("corporate:approvals:write")` — defense in depth; the server is the
  real authority. A client-side `AuthGuard` in the dashboard layout is the route guard.
- Corporate vs Personal is **not** a role — it's a profile switch (§ Module 06). Both can
  co-exist on one identity; the active profile changes which payment methods, policies, and
  booking history are visible, not what the user is allowed to do in the abstract.

---

## 4. Data layer — RTK Query + caching

- One shared `baseApi` (`lib/api/baseApi.ts`) created with `createApi`; per-page slices use
  `baseApi.injectEndpoints` so the cache and tag system are unified.
- **Caching:**
  - Define **tag types** per domain (`'Booking'`, `'Traveller'`, `'Itinerary'`, `'Supplier'`,
    `'Fare'`, `'VaultDocument'`, `'CorporateApproval'`, …).
  - `providesTags` on reads, `invalidatesTags` on mutations so issuing a ticket refreshes
    the booking list, the traveller's vault, and any pending approval automatically.
  - Tune `keepUnusedDataFor` short for anything price-sensitive (fares expire / reprice) —
    never let a cached fare silently outlive the supplier's quote TTL. Prefer explicit
    refetch-on-mount for fare quotes over long cache lifetimes.
- **Every query argument that changes the result must be part of the query key**
  (origin, destination, dates, pax count, cabin class, companyId, profile, …) — mirrors the
  server cache-key rule (§6.4). A missing arg = a customer seeing someone else's cached fare.
- Co-locate each page's endpoints in its `lib/*.api.ts`; only `baseApi` + store wiring are
  global.

---

## 5. Conventions

- **Money & numbers:** never use floats for money — use integer minor units or a decimal
  type end-to-end (fares, taxes, margins, refunds); format only at the edge. Multi-currency
  is in scope (supplier net fares, corporate billing) — always carry currency alongside the
  amount, never assume a single currency.
- **Validation:** shared Zod (or equivalent) schemas in the page's `lib/*.schema.ts`, reused
  by forms and as the contract for the API call. Traveller documents (passport numbers,
  CNIC, visa numbers) need real format validation, not just "non-empty".
- **Dates & time zones:** flights/visas/documents are inherently multi-timezone. Store all
  timestamps in UTC; render in the relevant local timezone (departure airport, traveller's
  timezone) explicitly labelled — never rely on browser-local time for anything
  itinerary-related.
- **Naming:** PascalCase components, camelCase hooks/utils, `*.api.ts` / `*.schema.ts` /
  `*.store.ts` suffixes — matches the sister apps.
- **Accessibility & i18n:** plan for multi-language support (at minimum English/Urdu/Arabic,
  matching the sister platforms) — keep strings externalizable and layouts RTL-tolerant from
  the start; retrofitting i18n into a chat UI is expensive.

---

## 6. Server — engineering notes (shared-DB assumption)

If the server ends up on the same remote/shared Postgres-via-PgBouncer pattern as
`crm-server`, the following applies without modification — **every query is a network
round-trip, and heavy queries on one process slow everything else.** The bottleneck is
almost always **DB query volume/cost, not Node CPU.**

Follow a modular structure (`modules/<domain>/<domain>.service.js`, etc.), same as
`crm-server`.

### 6.1 Aggregate in the database, never in JS
- Use `count`, `groupBy`, `aggregate` (`_sum`/`_avg`/`_count`) or `$queryRaw`. **Never**
  `findMany` a set of rows just to `.reduce()`/`.filter()`/`.length` them — that loads every
  row over the wire and blocks the event loop. Dashboard/reporting queries (Module 17) are
  the biggest risk here.
- For per-row date math / conditional sums, use `$queryRaw` with `FILTER (WHERE ...)` and
  `EXTRACT(EPOCH FROM ...)`, not a row load + JS loop.

### 6.2 Prisma gotchas
- **`distinct: [...]` does NOT emit SQL `DISTINCT`.** Prisma fetches *every* matching row and
  dedupes in the query engine (you'll see `OFFSET 0` with no `LIMIT`). On large tables use
  `prisma.$queryRaw\`SELECT DISTINCT "col" FROM ...\`` instead.
- **`include: true` on a relation selects every column**, including `metadata` (Json) and
  audit columns. Always use `{ select: { id: true, label: true } }` for lookup relations
  (airports, airlines, statuses, lookup tables).
- Select only the columns you use. Over-fetching bloats both DB transfer and the JSON
  payload — booking search responses are already large before adding unused columns.

### 6.3 Don't fan out unbounded concurrency
- `Promise.all(items.map(...))` over hundreds of rows/travellers/suppliers floods the
  connection pool and serializes on the DB. Use a bounded `mapLimit(items, ~5, fn)` helper.
- Watch for N+1: a query inside a `.map`/loop. Batch it into one
  `findMany({ where: { id: { in } } })` and build a `Map`. This is especially easy to get
  wrong when enriching a list of bookings with traveller/supplier/status lookups.
- **Supplier calls (Galileo, RateHawk) are not DB calls but obey the same rule** — never fan
  out one supplier request per item in a loop; batch or parallelize with a small, explicit
  concurrency cap and a circuit breaker (see §7).

### 6.4 Cache expensive reads
- Reports/dashboards should use stale-while-revalidate + single-flight caching (mirror
  `withReportCache` / `withDashboardSection` / `lib/swr-cache.js` from `crm-server` if that
  library is shared, or reimplement the same pattern).
- **Include every query param that changes the result in the cache key** (companyId, from,
  to, periodType, currency, profile, …). A missing param = stale/wrong cache hits.
- Single-flight matters: concurrent identical requests (e.g. a dashboard firing several
  widgets at once, or React double-mount) should dedup into one compute.
- Static lookups (airports, airlines, visa-requirement tables, statuses) should be cached
  in-memory for minutes, not re-queried per request.

### 6.5 Index what you filter and sort on
- Add `@@index` for new hot `where`/`orderBy` columns in `prisma/schema.prisma`, then a
  migration. Zero-downtime indexes go via `CREATE INDEX CONCURRENTLY` run with psql on the
  direct port, not through `prisma migrate deploy`.
- Verify with `EXPLAIN (ANALYZE, BUFFERS)` — a single query in isolation should be
  milliseconds. Booking search and itinerary lookups are on the customer-facing hot path;
  treat any P95 regression there as a launch blocker, not a follow-up.

### 6.6 Profiling
- Log slow queries in development (`PRISMA_QUERY_LOG` / equivalent, threshold ~700ms) before
  shipping a new report or search endpoint.
- Build a `profile-*` script per expensive report/search path once it exists, mirroring
  `scripts/db/profile-overview.mjs` in `crm-server`.

### 6.7 Workers (background jobs)
- Journey monitoring (Module 09), document-expiry reminders (Modules 02/08), and refund
  processing (Module 14) are natural background workers. They share the same DB — be a
  gentle citizen: only process **active** rows (upcoming trips, unexpired documents), **skip
  DB writes on idle ticks**, **batch existence checks** before per-row writes, and **pace**
  polling against supplier APIs (rate limits, not just DB load).
- Keep worker pool size and concurrency explicit and small; never let a worker's backlog
  processing starve the customer-facing API for connections.

---

## 7. FlightOne-specific server rules (from the PRD)

These are non-negotiable invariants the API must enforce regardless of the client, derived
from the "shall" statements in the PRD. Treat this list as a starting point — extend it as
each module's design firms up, the same way the ERP guide's §7 grew out of its FRS.

- **AI never has unilateral authority over money or documents.** The AI Booking Engine
  (Module 03) proposes; a server-side pricing/policy check is the actual authority before
  any payment is captured or ticket is issued (BR analogue to "server is the real
  authority"). This is what makes AI discount limits, corporate policy enforcement, and
  supplier margin protection possible at all.
- **Every booking transitions through an explicit, auditable state machine** (e.g.
  Quoted → Reserved → Ticketed → Active → Completed/Cancelled/Refunded). No silent
  transitions; every state change is attributable to an actor (AI, agent, customer, system)
  and timestamped.
- **Pricing is computed and re-validated server-side at every step** (quote, reserve, pay) —
  a price shown in a chat message is not the price charged; always re-price against the
  supplier and the margin engine immediately before capture, and surface a "price changed"
  flow to the customer if it drifts.
- **Ticketing/voucher issuance is idempotent.** Retries (network blips, double-clicks, AI
  retries) must never double-issue a ticket or double-charge a card — use an idempotency key
  per booking attempt.
- **Corporate spend is policy- and budget-gated before commitment**, not after — an approval
  workflow / credit-limit check runs before a supplier reservation is made, not as a
  post-hoc reconciliation step (Module 06).
- **Document expiry is proactively tracked and notified**, not just displayed on request
  (passports, visas, residence permits — Modules 02/07/08).
- **Human escalation carries full context.** The complete AI conversation + booking state
  hands off to a live consultant with nothing lost — this is a hard product requirement
  (Module 13), not a nice-to-have.
- **Refund/reissue calculations are deterministic and re-creatable from stored inputs**
  (airline rules, supplier penalty, agency fee) — never a one-off manual number with no
  audit trail (Module 14).
- **All financial and document-vault actions are audit-logged**, immutable, and
  attributable, mirroring the ERP platform's audit-log invariant.
- **Supplier integrations are isolated behind an adapter layer** (Supplier Integration
  Layer, per the PRD's architecture) so Galileo/RateHawk today and Amadeus/Sabre/NDC/
  Hotelbeds/etc. later are swappable without touching booking orchestration or pricing
  logic. Every adapter needs a timeout, retry policy, and circuit breaker — a slow/down
  supplier must degrade gracefully, not take the whole booking flow down with it.

---

## 8. Definition of Done (per checklist item)

1. Server endpoint(s) with auth + RBAC/entitlement guard + validation.
2. State-machine transition (if applicable) recorded with actor + timestamp; audit log
   entry written.
3. RTK Query endpoint with correct tags/invalidation.
4. UI colocated under the page dir, components ≤ 300 lines, permission-gated.
5. Pricing/financial impact re-validated server-side, not trusted from client input.
6. Supplier-facing calls (if any) have a timeout, retry policy, and failure fallback.
7. Verified against the relevant PRD "shall" statement and ticked in the module doc.

---

## 9. Suggested repo/service layout

Until a formal architecture spike happens, default to mirroring the sister platforms so
tooling, CI, and engineer ramp-up stay consistent:

- `flight-one` (this repo) — Next.js client.
- `flight-one-api` — modular Node API (mirrors `crm-server/modules/*`), one module per
  numbered doc in `docs/modules/`.
- `flight-one-workers` — background jobs (journey monitoring, document-expiry reminders,
  refund automation, recurring notifications).
- AI Conversation Engine and Supplier Integration Layer may start as modules inside
  `flight-one-api` and be split into standalone services only once there's a concrete
  scaling or deployment reason (independent release cadence, different language/runtime for
  the AI layer, etc.) — don't over-decompose into microservices before module boundaries
  are proven. This is the same "premature abstraction" trap called out for application code,
  just at the service level.

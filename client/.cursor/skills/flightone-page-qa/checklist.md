# FlightOne Page QA — Checklist

Use with [SKILL.md](SKILL.md). Gold UI: `/profile`. Gold data gates: `ProfilePageClient` auth/loading/error blocks.

---

## Design (P1)

### Structure
- [ ] Master stage wrapper + page CSS imported
- [ ] Nav rail: brand badge (pulse/dot + uppercase label)
- [ ] Capsule tabs: `h-9`, active = dark or `bg-black/6` + border (same height as Ava CTA)
- [ ] Action pill(s) on rail right
- [ ] Hero: eyebrow · title · lede · CTA group
- [ ] Optional scenic right panel / dial / facepile (profile/vault/journey pattern)
- [ ] Body: frosted cards, `rounded-2xl`+, `border-black/8`, soft shadow
- [ ] Status chips: `emerald` / `sky` / `amber` / `danger` semantic tints
- [ ] Modals: backdrop blur + `rounded-3xl` card; Escape/close works

### Primitives
- [ ] Uses `Button` / `Input` / `SearchableSelect` / `Spinner` from `@/components/ui`
- [ ] Icons from `lucide-react` only
- [ ] No `bg-[var(--sky)]/10` — use `bg-sky/10`, `border-black/8`, etc.

### Motion
- [ ] Hover lift / active scale restrained
- [ ] `@media (prefers-reduced-motion: reduce)` disables non-essential motion

---

## API (P2)

### Auth bootstrap
- [ ] `hasHydrated` + `accessToken` from `useAuthStore`
- [ ] Protected queries: `skip: !hasHydrated || !accessToken`
- [ ] No duplicate refresh; rely on `refreshSessionOnce` via providers / baseApi

### Reads
- [ ] Loading flag used for UI
- [ ] `isError` / missing data → error UI with `refetch`
- [ ] Empty array ≠ error (dedicated empty UI)

### Writes
- [ ] Mutation `isLoading` disables controls
- [ ] Success invalidates or refetches list/detail
- [ ] Failure shows message (toast or inline)

### Special
- [ ] File upload: type/size validation + progress/disabled
- [ ] Download blob: auth header + revoke URL
- [ ] Polling: stopped when unmounted / tab inactive if applicable
- [ ] Capability endpoint gates UI when present

---

## UX states (P3)

| State | Required UI |
|-------|-------------|
| Hydrating / loading | Spinner + status line, stable min-height |
| Logged out | Auth gate + Sign in with `?redirect=` |
| Error | Title + copy + Retry |
| Empty | Icon + copy + primary CTA |
| Success | Real content |
| Pending mutation | Disabled button / “Saving…” |
| Field error | Under-field message, `aria-invalid` |

Copy tone: clear, short, action-oriented — match profile (“Authentication Required”, “Retry Connection”).

---

## Plug-together smoke (P5)

- [ ] `/login?redirect=<route>` round-trip
- [ ] Happy path load
- [ ] Error + retry (if testable)
- [ ] Empty CTA (if testable)
- [ ] One write path
- [ ] SiteNav active pill vs Ava height
- [ ] Footer Lucide icons, no gimmick trust-pill spam
- [ ] Narrow viewport: no overflow; mobile menu works

---

## Severity guide (report)

- **Blocker** — data wrong, auth broken, crash, can't recover from error
- **Major** — missing state UI, design not on-system, mutation silent-fail
- **Minor** — spacing, copy, lint warnings
- **Nit** — polish only

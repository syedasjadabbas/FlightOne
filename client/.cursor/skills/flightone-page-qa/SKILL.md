---
name: flightone-page-qa
description: >-
  Senior QA flow for FlightOne traveller pages: implement AIVENTURE design system,
  verify RTK/auth API wiring, harden loading/empty/error/auth UX, fix gaps, then
  smoke-verify end-to-end. Use when the user asks to redesign a page like profile/
  vault/journey, ship a route to design-system standards, or run page QA / senior
  QA / plug-it-together on a client app route.
disable-model-invocation: false
---

# FlightOne Page QA (Design → API → UX → Ship)

Reusable senior-engineer loop for any traveller page under `client/app/<route>/`.

**Gold references (match these, don't invent a third language):**
- Design: `app/profile/ProfilePageClient.tsx`, `app/profile/profile.css`
- Vault/Journey already shipped: `app/vault/*`, `app/journey/*`
- UI primitives: `components/ui/Button.tsx`, `Input.tsx`, `SearchableSelect.tsx`, `Spinner`
- Chrome: `components/SiteNav.tsx`, `components/SiteChromeFooter.tsx`

Read [checklist.md](checklist.md) for the full state matrix. Read [examples.md](examples.md) for invocation patterns.

## Input (required)

User names one or more routes, e.g. `/vault`, `/journey`, `/rewards`.

Optional: "design only" | "QA only" | "full" (default **full**).

## Operating rules

1. **Preserve behavior** — RTK hooks, mutations, auth, uploads, polling stay intact unless fixing a real bug.
2. **Match profile language** — master-stage, nav-rail, brand-badge, hero showcase, frosted cards, capsule tabs (`h-9`), dark Ava-style CTAs.
3. **Auth-safe data** — every protected query uses `skip: !hasHydrated || !accessToken`. Never race refresh.
4. **State matrix required** — loading, unauthenticated, error+retry, empty+CTA, success. No blank screens.
5. **Tailwind hygiene** — `bg-sky/10`, `border-black/8` (not `bg-[var(--sky)]/10` or `border-black/[0.08]`).
6. **Scope** — only the named route tree + shared primitives if broken. No drive-by refactors.
7. **Prove it** — lint clean; browser smoke if app is running.

Copy and track:

```
Page QA — /<route>
- [ ] P0 Inventory
- [ ] P1 Design system
- [ ] P2 API integration
- [ ] P3 UX states
- [ ] P4 Fixes
- [ ] P5 Plug-together smoke
- [ ] P6 Report
```

---

## P0 — Inventory (read before editing)

1. List route files: `page.tsx`, `*PageClient.tsx`, `_components/*`, `*.css`.
2. Find RTK endpoints: `useGet*Query` / `use*Mutation` in `client/lib/api/*`.
3. Note auth gates, polls, uploads, downloads, share links.
4. Snapshot current loading/error/empty handling (or lack thereof).
5. Open gold refs above; note 3–5 concrete patterns to copy (class names, gate UI, Button variants).

Do **not** start redesign until inventory is written (short bullets in the reply or todo list).

---

## P1 — Design system

Apply AIVENTURE structure (see checklist § Design):

| Layer | Pattern |
|-------|---------|
| Shell | `fo-<route>__master-stage` (+ ambient CSS) |
| Rail | brand-badge · capsule tabs · action pill(s) |
| Hero | eyebrow · display title · lede · CTA group · scenic/right panel optional |
| Body | frosted panels `rounded-2xl/3xl`, `border-black/8`, soft shadow |
| Actions | `Button` `primary`/`dark`/`secondary`/`ghost`/`danger`; capsules `h-9` |
| Icons | `lucide-react` only — production glyphs, no decorative emoji |

CSS: colocate `app/<route>/<route>.css`; import from page client. Prefer existing token classes (`text-navy`, `text-sky`, `text-ink-soft`).

**Stop condition:** Page visually belongs next to `/profile` without reading as a different product.

---

## P2 — API integration audit

For every query/mutation on the page:

| Check | Pass criteria |
|-------|----------------|
| Skip | `skip: !hasHydrated \|\| !accessToken` on protected reads |
| Hydration | No fetch before `hasHydrated`; no double-refresh race |
| Errors | Surface `isError` / mutation error; user can retry |
| Mutations | Disable submit while pending; success/error feedback |
| Invalidation | Tags/`refetch` after write so UI updates |
| Blobs / downloads | Token passed correctly; revoke object URLs |
| Capability flags | Feature gated when API returns capability |

Trace each hook to `lib/api/*.api.ts` and confirm endpoint path matches server route.

**Fix immediately** any skip/hydration/retry gaps before polishing UI further.

---

## P3 — UX state standards

Implement (or upgrade to) the profile-grade gates:

1. **Boot / loading** — centered `Spinner` + short status line; min-height so layout doesn't jump.
2. **Unauthenticated** — lock icon, title, one-sentence why, primary CTA → `/login?redirect=<path>`.
3. **Error** — clear title, short cause, **Retry** calling `refetch()` (or equivalent).
4. **Empty** — icon, honest copy, primary next action (upload / Ask Ava / etc.).
5. **Success** — real data; no placeholder lies.
6. **Inline** — field errors under inputs; mutation toasts/banners with dismissible or auto-clear.

A11y: labels on icon buttons, `aria-expanded` on menus, focus-visible rings, `prefers-reduced-motion` respected in CSS.

---

## P4 — Fix loop

Priority order:

1. Broken auth / data race / missing skip  
2. Missing error/empty/loading  
3. Design inconsistencies vs profile  
4. Lint / Tailwind warnings  
5. Microcopy / polish  

After each batch: `ReadLints` on touched files. Zero new warnings.

---

## P5 — Plug-together smoke (senior QA)

With `npm run dev` running (client + API):

1. Logged-out → hit route → auth gate → Sign in → land back (redirect).
2. Logged-in happy path → data loads; primary CTA works.
3. Force error if practical (stop API / bad id) → error + Retry recovers.
4. Empty path if practical → empty CTA works.
5. One mutation (save / upload / poll) → pending UI → success refresh.
6. Nav active tab height matches Ava capsule (`h-9`); footer icons are Lucide, not gimmick badges.
7. Mobile: hamburger opens; no horizontal overflow on hero.

If browser tools available: snapshot + screenshot auth gate, loaded hero, one modal if any.

---

## P6 — Report (always)

```markdown
## Page QA — /<route>

### Design
- …

### API
- hooks audited: …
- fixes: …

### UX states
- loading / auth / error / empty: pass|fixed|gap

### Smoke
- …

### Residual risk
- …
```

Be honest about what was not smoke-tested.

---

## Anti-patterns (reject)

- Redesigning without inventory  
- New purple/cream/newspaper aesthetic (stay FlightOne navy/sky)  
- Cards in hero for decoration only  
- Fetching while `!hasHydrated`  
- Swallowing errors with empty catch  
- Leaving dead CSS / duplicate competing layouts  
- Scope creep into unrelated routes  

## When to spawn subagents

For **2+ large routes**, spawn **one** `frontend-engineer` (or generalPurpose) with this skill's P0–P6 pasted + route list — same as vault+journey — then parent runs P5 smoke + P6 report. Do not spawn parallel agents that edit the same shared `Button`/`SiteNav` files.

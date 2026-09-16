# Traveller Core Polish Spec

**Status:** buildable implementation spec for frontend-engineer  
**Scope:** `/login`, `SiteNav`, `/trips` (+ `/trips/[id]`), `/profile` (+ companions patterns)  
**Out of scope:** chat hero (`ChatLayout`, `BrandMark`, `MessageBubble`, `OfferCardView`, `TypingDots`)  
**Source of truth:** [`docs/design/README.md`](./README.md), [`docs/design/components.md`](./components.md), `app/globals.css`  
**Constraint:** extend the existing system — no new colors, fonts, shadows, or radius values

---

## 0. Audit findings (confirmed in code)

| Surface | Gap |
|---|---|
| `LoginForm` | Hand-rolled `<input>`/`<button>`; raw `var()`; frosted panel is bespoke white/82, not `Surface`; submit uses `book-btn` (chat-only class) |
| `ProfileForm` / `AddCompanionForm` | Same hand-roll as login; companions submit uses `bg-ink` instead of ember primary |
| `/trips`, `/profile` pages | Hand-rolled `<h1>` instead of `PageHeader` |
| `TripList` | Loading = plain text; empty = frosted custom card; CTA = ink fill (not ember); cards hand-roll frost instead of `Surface interactive` |
| `TripDetail` | Loading = plain text; error CTA = ink; panel hand-rolled; back link underspecified |
| `StatusBadge` | Forks `Badge` with custom hues (`horizon-cool`) and non-system label tracking |
| `SiteNav` | 9–10 links + logout wrap chaotically below ~640px; no overflow pattern; active state is color-only |
| Shared | Incomplete state matrices (no skeletons, no retry on error, weak success feedback); prefer Token utilities over raw `var()` |

**Reference pattern to mirror:** `/vault` already uses `PageHeader` + `EmptyState` + `Surface` + `Button`/`Input`. Traveller-core polish brings login/trips/profile to that bar (and upgrades page-level loading to skeletons).

---

## 1. Shared conventions (apply to every screen below)

### 1.1 Page shell

```
main.sky-stage.relative.flex.flex-1.justify-center.px-4.py-8.sm:py-10
  └─ div.relative.z-10.w-full.{max-w-*}
       └─ content
```

| Route | Content `max-w-*` |
|---|---|
| `/login` | `max-w-sm` (384px), vertically centered (`items-center py-16`) |
| `/trips`, `/trips/[id]` | `max-w-2xl` (672px) |
| `/profile`, `/profile/companions` | `max-w-lg` (512px) |

Keep existing `sky-stage` + orbs on login only (login already has `sky-orb--a/b`). Traveller pages inherit atmosphere from `.sky-stage` alone — do not add orbs.

### 1.2 Typography scale (exact)

| Role | Classes | Notes |
|---|---|---|
| Page title | `font-display text-2xl font-semibold tracking-tight text-ink` | Via `PageHeader` |
| Form panel title (login) | `font-display text-[1.6rem] font-semibold leading-none text-ink` | Keep current size |
| Section label | `font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint` | History, product type |
| Product/meta label | `font-display text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint` | Trip card / detail |
| Body / supporting | `text-[14px] text-ink-soft` | PageHeader subtitle, body copy |
| Field label | handled by `Input` (`text-[13px] font-medium text-ink-soft`) | Do not hand-roll |
| Meta / tertiary | `text-[12px] text-ink-faint` | Dates, back links, user label |
| Price (list) | `font-display text-[15px] font-bold text-ink` | Trip card |
| Price (detail) | `font-display text-base font-bold text-ink` | Detail facts grid |
| Nav wordmark | `font-display text-[13px] font-semibold text-ink` | SiteNav bar |
| Nav link | `text-[13px] font-medium` | Active `text-ink`, idle `text-ink-soft` |

### 1.3 Spacing rhythm (4/8)

| Context | Values |
|---|---|
| Page header → content | `mt-6` / parent `space-y-6` |
| Form field stack | `space-y-4` (prefer over current `space-y-3.5`) |
| List item gap | `space-y-2.5` |
| Card internal | `p-4` (list) / `p-5 sm:p-6` (detail) |
| Nav bar | `px-4 py-3 sm:px-6`; link gap `gap-4` (desktop), `gap-3.5` (compact) |
| Section divider | `border-t border-line pt-4 mt-5` |

### 1.4 Color / tokens (utilities only in new code)

Use Tailwind token utilities. Do **not** introduce hex values.

| Need | Token / utility |
|---|---|
| Primary text | `text-ink` |
| Secondary | `text-ink-soft` |
| Tertiary / placeholder | `text-ink-faint` |
| App bg | `bg-paper` (via sky-stage) |
| Field fill | Input primitive → `bg-[var(--paper-elevated)]` |
| Frosted interactive panel | `Surface` → `bg-[var(--surface)]` |
| Hairline | `border-line` |
| Primary CTA | `Button variant="primary"` → `bg-ember` |
| Live / success | `text-signal` / `Badge tone="positive"` |
| Error text / field error | `text-ember` (via `Input error` / `role="alert"`) |
| Focus ring | `focus-visible:ring-signal-bright/40`–`/50` (primitives already) |

**Ember rule:** exactly one primary action per screen (login submit, profile save, trips empty → chat, companions add). Secondary actions use `secondary` or `ghost`.

### 1.5 Component mapping (global vs colocated)

| Use `components/ui/*` | Keep colocated |
|---|---|
| `Button`, `Input`, `Select`, `PageHeader`, `EmptyState`, `Surface`, `Badge`, `Spinner` | `LoginForm`, `TripList`, `TripCard` (extract if helpful), `TripDetail`, `Timeline`, `ProfileForm`, `CompanionList`, `AddCompanionForm`, `SiteNav` |
| — | `TripListSkeleton`, `TripDetailSkeleton`, `ProfileFormSkeleton` (colocated; no new ui primitive unless ≥2 routes need identical skeleton API — then optional later) |

**Replace** colocated `StatusBadge` styling with `Badge` tones (mapping in §4.4). Delete custom status CSS.

### 1.6 Skeleton pattern (no Spinner for page loads)

There is no `Skeleton` primitive today. Spec a **colocated** pattern (do not add a ui primitive in this pass unless engineer prefers extracting after second use):

```tsx
// Visual recipe — repeat bars/blocks with:
className="animate-pulse rounded-xl bg-mist/40 motion-reduce:animate-none"
// or for card shells:
className="animate-pulse rounded-2xl border border-line bg-[var(--surface)] p-4"
```

Use `aria-busy="true"` + `aria-live="polite"` region with visually hidden “Loading…” text. Prefer 2–3 placeholder rows matching final layout height to avoid CLS.

### 1.7 Error panel pattern (retry)

For list/detail load failures, use `EmptyState` (not frosted Surface):

- Title + description (exact strings per screen)
- `action={<Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>}`
- Auth failure (401): secondary CTA → `/login` instead of retry

### 1.8 Motion notes (for animation-engineer later)

Easing: `cubic-bezier(0.22, 1, 0.36, 1)` only.  
All motion must honor `prefers-reduced-motion` (disable named `.anim-*`; zero transform/opacity animation under reduce).

| Element | Purpose | Suggestion |
|---|---|---|
| Login / profile form Surface | Arrive ready | Keep `anim-scale` (already reduced-motion safe via globals) |
| SiteNav | Soft presence | Keep `anim-fade` |
| Trip list items | Continuity on load | Stagger `anim-rise` with `animationDelay: ${i * 70}ms`, max ~5 items then no delay |
| Trip card hover | Affordance | `Surface interactive` / `.offer-surface` lift (−2px) — already in system |
| Primary Button press | Feedback | Rely on Button color transition; optional later `active:scale-[0.98]` if aligned with `book-btn` — **do not** attach `.book-btn` outside chat |
| Pagination / refetch | Calm | Instant swap or `anim-fade` on list container only |
| Success “Saved” | Confirmation | Fade/opacity 150–200ms; no bounce |

Forms/tables stay calmer than chat — no `anim-brand`.

---

## 2. `/login` — page + `LoginForm`

### 2.1 Information hierarchy

1. **Lead:** “Welcome back” (display)
2. **Support:** “Log in to pick up where you left off with Ava.”
3. **Primary action:** Log in (ember)
4. **Tertiary:** “Back to Ava” link

### 2.2 Layout

- `main`: `sky-stage relative flex flex-1 items-center justify-center px-4 py-16`
- Orbs: keep `sky-orb--a`, `sky-orb--b` (`aria-hidden`)
- Form column: `relative z-10 w-full max-w-sm`
- Panel: `Surface padding="lg"` (use `sm:p-8` via `className="sm:p-8"` if needed — Surface `lg` is `p-6`; allow `className="p-6 sm:p-8"`)
- Suspense fallback: replace `null` with a form-shaped skeleton (same max-w-sm) so the stage doesn’t flash empty

### 2.3 Typography / spacing / color

- Title: `font-display text-[1.6rem] font-semibold leading-none text-ink`
- Subtitle: `mt-2 text-[14px] text-ink-soft`
- Form: `mt-6 space-y-4`
- Footer link: `mt-5 text-center text-[13px] text-ink-faint`; link uses `text-signal` on hover optional — default: underline `underline-offset-2`, inherit faint, hover `text-ink-soft`

### 2.4 Component mapping

| Current | Target |
|---|---|
| Bespoke frosted div | `Surface` (`padding="lg"`) |
| Hand-rolled email/password | `Input` (`type="email"` / `type="password"`, labels, `autoComplete`) |
| Hand-rolled submit + `book-btn` | `Button type="submit" className="w-full"` (`variant="primary"` default) |
| Inline error `<p>` | Keep `role="alert"` below fields; optionally pass field-level `error` only for validation — auth failure stays form-level alert |

### 2.5 State matrix

| State | Spec |
|---|---|
| **Default** | Empty fields; primary “Log in” enabled when both fields non-empty (or keep HTML `required` — either is fine; prefer native `required`) |
| **Hover** (submit) | Button primary hover (ember darken) |
| **Focus-visible** | Input/Button primitives’ signal-bright rings; tab order: Email → Password → Log in → Back to Ava |
| **Active** | Button pressed (browser + color transition) |
| **Disabled** | Submit `disabled={isLoading}`; Input `disabled` while loading |
| **Loading** | Submit shows `<Spinner size="sm" className="border-white/30 border-t-white" />` + label “Logging in…”; `aria-busy` on form |
| **Empty** | N/A (form always present) |
| **Error** | Form-level `role="alert"` `text-[13px] text-ember`: **“Incorrect email or password.”** (401) or **“Something went wrong — please try again.”** (other). Do not clear password on 401. |
| **Success** | Navigate away (`redirect` or `/`) — no success toast on this screen |

### 2.6 Microcopy (exact)

| Key | String |
|---|---|
| Title | `Welcome back` |
| Subtitle | `Log in to pick up where you left off with Ava.` |
| Email label | `Email` |
| Email placeholder | `you@example.com` |
| Password label | `Password` |
| Password placeholder | `••••••••` |
| Submit | `Log in` |
| Submit loading | `Logging in…` |
| Error 401 | `Incorrect email or password.` |
| Error other | `Something went wrong — please try again.` |
| Tertiary link | `Back to Ava` |
| Page title (metadata) | `Log in — FlightOne` |

### 2.7 A11y

- Visible labels via `Input` `label` prop (never placeholder-only)
- `autoComplete="email"` / `autoComplete="current-password"`
- Error in `role="alert"` (or `aria-live="assertive"`)
- Focus first invalid field on client validation if added later; for API 401, keep focus on password
- Target size: full-width md Button (≥40px height)
- Contrast: ink on paper/surface; white on ember — already AA

### 2.8 Motion notes

- Panel entrance: `anim-scale`
- No list stagger
- Spinner only on button while pending

---

## 3. `SiteNav` — bar + compact

### 3.1 Information hierarchy

1. **Lead (bar only):** FlightOne wordmark → `/`
2. **Primary nav:** core traveller destinations (see prioritization)
3. **Support:** user label (bar, `sm+` only)
4. **Tertiary:** Log out

### 3.2 Nav information architecture (mobile fix)

**Problem:** 9–10 equal-weight links overwhelm <640px.

**Primary links (always visible in both variants):**

1. Trips (`/trips`)
2. Vault (`/vault`)
3. Profile (`/profile`)

**Secondary links** (desktop bar: visible inline; compact + mobile bar: behind “More” disclosure):

- Visa, Rewards, Journey, Groups, MICE, Corporate
- Dashboard — only if `canSeeDashboard` (append to secondary, or primary if ops-heavy — keep as last secondary item)

**Recommendation:** Implement a simple disclosure, not a full hamburger drawer:

```
[FlightOne]  Trips  Vault  Profile  [More ▾]  · user · [Log out]
```

`More` is a `<button>` + absolutely positioned panel (`Surface padding="sm"`) listing secondary `Link`s. Close on outside click / Escape / route change.

Compact variant (chat banner): same priority — show Trips / Vault / Profile + More + Log out ghost. Do not dump all links in a wrap row.

### 3.3 Layout

**Bar (`variant="bar"`):**

- `nav`: `relative z-10 flex items-center justify-between gap-4 border-b border-line bg-[rgba(255,255,255,0.65)] px-4 py-3 backdrop-blur-md sm:px-6`
- Left: wordmark
- Right: `flex items-center gap-3 sm:gap-4` (nowrap on `sm+`; allow More panel to overflow)
- Min height touch targets: links `min-h-8 py-1.5`, buttons already `h-8` sm

**Compact (`variant="compact"`):**

- `nav`: `anim-fade flex flex-wrap items-center gap-3 px-0.5 text-[13px]` — prefer **no wrap** of primary trio; More absorbs overflow
- Log out: `Button variant="ghost" size="sm"`

### 3.4 Active state (not color-only)

| State | Treatment |
|---|---|
| Idle | `text-ink-soft hover:text-ink` |
| Current | `text-ink` + `underline underline-offset-4 decoration-signal/60` **or** bottom border on bar links: `border-b-2 border-signal` with `pb-0.5` |
| Focus-visible | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-bright/50 rounded-sm` |

Match via `pathname === href || pathname.startsWith(`${href}/`)` (existing). Profile should also match `/profile/companions`.

### 3.5 Component mapping

| Element | Primitive |
|---|---|
| Log out (bar) | `Button variant="secondary" size="sm"` — keep |
| Log out (compact) | `Button variant="ghost" size="sm"` — keep |
| More panel | `Surface padding="sm"` as menu container; links plain |
| Wordmark | `<Link>` — keep colocated |

Do **not** wrap the whole nav in `Surface`.

### 3.6 State matrix

| State | Spec |
|---|---|
| **Default** | Hydrated + authenticated → render; else `null` |
| **Hover** | Link underline / text-ink; More button secondary hover |
| **Focus-visible** | Ring on links, More, Log out |
| **Active** | Current route indicator (underline or border) |
| **Disabled** | Log out may disable while logout mutation pending (`disabled={isLoggingOut}`) |
| **Loading** | `hasHydrated === false` → render nothing (avoid flash). Optional: reserve `h-[49px]` spacer in layout if CLS matters — not required for v1 |
| **Empty** | N/A |
| **Error** | Permissions query fail → hide Dashboard only; rest of nav still works |
| **Success** | Logout → auth store clears → nav unmounts |

### 3.7 Microcopy

| Key | String |
|---|---|
| Wordmark | `FlightOne` |
| Primary | `Trips`, `Vault`, `Profile` |
| Secondary | `Visa`, `Rewards`, `Journey`, `Groups`, `MICE`, `Corporate`, `Dashboard` |
| More button | `More` |
| More `aria-expanded` / `aria-controls` | wire to panel id `site-nav-more` |
| Log out | `Log out` |
| Log out pending | `Logging out…` (optional) |

### 3.8 A11y

- `<nav aria-label="Account">` (bar) / `aria-label="Account shortcuts"` (compact)
- More: `aria-haspopup="true"`, `aria-expanded`, Escape closes, focus returns to More
- Keyboard: Tab through primary → More → (panel links when open) → user text (skip if not focusable) → Log out
- Do not rely on color alone for current route
- Touch targets ≥ 24px (prefer 32–40px padding on links)

### 3.9 Motion notes

- Nav: `anim-fade` on mount
- More panel: opacity + translateY(4→0) 150–200ms; under reduced-motion: instant show/hide

---

## 4. `/trips` — page + `TripList` + `/trips/[id]` (`TripDetail`)

### 4.1 `/trips` page

**Hierarchy**

1. Page title + subtitle (`PageHeader`)
2. Trip list / empty / error
3. Pagination (tertiary, only if `totalPages > 1`)

**Layout**

```
main.sky-stage … max-w-2xl
  PageHeader
  div.mt-6 → TripList
```

**PageHeader**

```tsx
<PageHeader
  title="Your trips"
  subtitle="Every quote, reservation, and ticket Ava has put together for you."
  actions={
    <Button size="sm" onClick={() => router.push("/")}>
      New trip
    </Button>
  }
/>
```

- Ember primary **only if** list is empty? **No** — empty state’s CTA is the single ember action on empty; when list has items, header “New trip” is the one ember action. When empty, hide header action and keep ember on EmptyState (avoid two embers). Spec rule: **if `items.length === 0` and not loading/error, omit PageHeader `actions`; EmptyState owns ember CTA.**

**Typography / spacing:** PageHeader defaults; `mt-6` before list.

### 4.2 `TripList` — component mapping

| Current | Target |
|---|---|
| Plain “Loading…” | `TripListSkeleton` (3 card placeholders) |
| Frosted empty card + ink CTA | `EmptyState` + `Button` primary “Chat with Ava” → `/` |
| Error frosted box | `EmptyState` + retry `Button secondary` |
| Hand-rolled card link | `Surface as={Link} interactive padding="md"` **or** `Link` wrapping `Surface interactive` — prefer `Surface` with `as={Link}` if `as` supports Next Link; else `Link className="block"` > `Surface interactive` |
| Pagination raw `<button>` | `Button variant="secondary" size="sm"` |

Extract optional colocated `TripCard` for clarity (still under `trips/components/`).

### 4.3 Trip card hierarchy (per row)

1. **Lead:** external ref / booking id (`text-[15px] font-semibold text-ink`, truncate)
2. **Support:** product label (display uppercase 10px) · supplier; status `Badge`; price
3. **Tertiary:** “Quoted {date}” (`text-[12px] text-ink-faint`)

Layout: `flex justify-between gap-3`; left `min-w-0`; right `shrink-0 text-right`.

### 4.4 Status → `Badge` tone mapping

Replace `StatusBadge` implementation to wrap `Badge`:

| Status | Label | Tone | `dot`? |
|---|---|---|---|
| `QUOTED` | Quoted | `neutral` | no |
| `RESERVED` | Reserved | `info` | no |
| `TICKETED` | Ticketed | `positive` | no |
| `ACTIVE` | Active | `positive` | yes |
| `COMPLETED` | Completed | `neutral` | no |
| `CANCELLED` | Cancelled | `neutral` | no (optional `className` line-through on label only — avoid if it hurts readability; prefer tone only) |
| `REFUNDED` | Refunded | `warning` | no |

Do **not** use `horizon-cool` for status (not a semantic UI accent). Keep labels Title Case as today (`Quoted`, not `QUOTED`).

### 4.5 `TripList` state matrix

| State | Spec |
|---|---|
| **Default** | List of interactive Surfaces |
| **Hover** | Card: offer-surface lift; pagination buttons secondary hover |
| **Focus-visible** | Entire card link focus ring (`focus-visible:ring-2 focus-visible:ring-signal-bright/50 rounded-2xl`); pagination buttons |
| **Active** | Card press (scale/lift reset) |
| **Disabled** | Prev disabled on page 1; Next on last page; both disabled while `isFetching` |
| **Loading** (initial) | Skeleton: 3 rows, each ~72px tall frosted-looking pulse blocks |
| **Loading** (page change) | Keep list visible; set `aria-busy` on list; optional opacity-70; do not unmount to skeleton |
| **Empty** | See microcopy; ember CTA |
| **Error** | EmptyState + Try again; if 401: “Please log in again.” + Button → `/login` |
| **Success** | N/A |

### 4.6 `/trips/[id]` — `TripDetail`

**Hierarchy**

1. Back link (“All trips”)
2. Product label + title (display) + status Badge
3. Facts grid (price, expiry/reserve windows, last updated)
4. History timeline (tertiary section)

**Layout**

- Container: `Surface padding="lg"` (`p-5 sm:p-6` via className if needed)
- Back link above title inside Surface
- Facts: `mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[13px] sm:grid-cols-3`
- Timeline: keep border-l signal dots (existing structure); section label per §1.2

**Do not** put PageHeader on detail — title is the booking ref inside the Surface (content is the interactive object). Optional: page-level visually hidden `<h1>` matching booking ref for a11y if the visible title is styled as `h1` (keep visible `h1` as today).

### 4.7 `TripDetail` state matrix

| State | Spec |
|---|---|
| **Default** | Surface with facts + timeline |
| **Hover** | Back link underline; timeline non-interactive |
| **Focus-visible** | Back link ring |
| **Loading** | `TripDetailSkeleton` — title bar + 3 fact cells + 3 timeline rows |
| **Empty** | N/A |
| **Error (404)** | `EmptyState` title/description + `Button secondary` “Back to trips” |
| **Error (other)** | `EmptyState` + `Button secondary` “Try again” (refetch) + secondary ghost “Back to trips” |
| **Success** | N/A |

### 4.8 Microcopy (exact)

**Trips list**

| Key | String |
|---|---|
| Page title | `Your trips` |
| Subtitle | `Every quote, reservation, and ticket Ava has put together for you.` |
| Header action | `New trip` |
| Empty title | `No trips yet` |
| Empty description | `Ask Ava for a flight, hotel, or package and it’ll show up here once quoted.` |
| Empty CTA | `Chat with Ava` |
| Error title | `Couldn’t load your trips` |
| Error description | `Please try again shortly.` |
| Error 401 description | `Please log in again.` |
| Retry | `Try again` |
| Login CTA | `Log in` |
| Pagination | `Page {n} of {total}` |
| Prev / Next | `Previous` / `Next` |
| Skeleton SR | `Loading your trips` |

**Trip detail**

| Key | String |
|---|---|
| Back | `← All trips` |
| Fact labels | `Price`, `Quote expires`, `Reserved until`, `Last updated` |
| History | `History` |
| Actor labels | `Ava (AI)`, `You`, `Agent`, `System` (keep) |
| 404 title | `Trip not found` |
| 404 description | `It may belong to another account, or the link is out of date.` |
| Error title | `Couldn’t load this trip` |
| Error description | `Please try again shortly.` |
| Back CTA | `Back to trips` |
| Retry | `Try again` |

### 4.9 A11y

- List: `<ul>` / `<li>`; each card is one link with accessible name = `{product} {ref} {status} {price}`
- Pagination: `nav aria-label="Trip list pages"`
- Detail timeline: `<ol>`; dots `aria-hidden`
- Loading: `aria-busy` + live region
- Status: text label in Badge (never color alone)
- Quote expiry: if within 24h, optionally `Badge tone="warning"` “Expiring soon” beside status — nice-to-have, not blocking

### 4.10 Motion notes

- List item stagger on first load only
- Card interactive lift via Surface
- Detail: `anim-fade` on Surface once data ready (optional)
- Skeleton: pulse only; `motion-reduce:animate-none`

---

## 5. `/profile` — page + `ProfileForm` (+ companions)

Companions are **tightly coupled** (same form/empty/Surface patterns) — include in this polish pass.

### 5.1 `/profile` page

**Hierarchy**

1. `PageHeader` title + subtitle
2. Profile form Surface (primary)
3. Companions deep link (tertiary, inside or below form)

```tsx
<PageHeader
  title="Your profile"
  subtitle="Keep this current so Ava books your seat and meal exactly how you like it."
/>
```

Max width `max-w-lg`. `mt-6` → form.

### 5.2 `ProfileForm` — component mapping

| Current | Target |
|---|---|
| Bespoke frosted panel | `Surface padding="lg"` |
| Hand-rolled inputs | `Input` for all four fields |
| Hand-rolled save + `book-btn` | `Button type="submit"` primary |
| Plain loading text | `ProfileFormSkeleton` (4 field bars + button bar) |
| Plain error box | `EmptyState` + Try again |
| Success “Saved” | Keep; use `text-[13px] font-medium text-signal` + `aria-live="polite"` |

Fields:

| Field | `Input` props |
|---|---|
| Display name | `label="Display name"` `placeholder="Your name"` `maxLength={120}` `autoComplete="name"` |
| Phone | `label="Phone"` `type="tel"` `placeholder="+1 555 000 1234"` `maxLength={32}` `autoComplete="tel"` |
| Seat preference | `label="Seat preference"` `placeholder="Aisle, window, front, back…"` `maxLength={60}` `hint="Optional — Ava uses this when booking."` |
| Meal preference | `label="Meal preference"` `placeholder="Vegetarian, halal, no restrictions…"` `maxLength={120}` `hint="Optional — include dietary or religious needs."` |

### 5.3 Profile state matrix

| State | Spec |
|---|---|
| **Default** | Seeded fields; Save enabled |
| **Hover** | Button primary hover |
| **Focus-visible** | Field order: Display name → Phone → Seat → Meal → Save → Companions link |
| **Disabled** | Save `disabled={isSaving}`; fields disabled while saving |
| **Loading** (fetch) | Skeleton |
| **Loading** (save) | Spinner in button + “Saving…” |
| **Empty** | N/A (profile always exists after auth) |
| **Error** (fetch) | EmptyState “Couldn’t load your profile” + Try again |
| **Error** (save) | Form-level `role="alert"`: `Couldn’t save — please try again.` (add if mutation fails; hook currently swallows — surface it) |
| **Success** | `Saved` in `aria-live="polite"`; clear after ~3s or on next edit |

### 5.4 Companions page (coupled patterns)

**Page**

- Back link → `/profile`: `text-[12px] text-ink-faint underline underline-offset-2` → prefer `Button variant="ghost" size="sm"` as link-styled, or keep text link for consistency with trip detail back
- Replace hand-rolled title with:

```tsx
<PageHeader
  title="Companions"
  subtitle="People you often book alongside — family, friends, colleagues."
/>
```

**CompanionList**

| State | Spec |
|---|---|
| Loading | Skeleton: 2 rows |
| Error | EmptyState + Try again |
| Empty | `EmptyState` title `No companions yet` description `Add someone below to book for them faster.` — **no** frosted card; **no** CTA here (form below is the action) |
| Default | List rows: flat or light Surface **non-interactive** for static rows — prefer **no Surface** on static rows (design system: frost = interactive). Use `rounded-2xl border border-line bg-paper-elevated px-4 py-3` for static rows |
| Remove | `Button variant="ghost" size="sm"` or danger-text: use `Button variant="ghost" size="sm" className="text-ink-faint hover:text-ember"` — on confirm optional; v1 keep one-click remove but label `Remove` |

**AddCompanionForm**

- Wrap in `Surface padding="lg"`
- Title: `font-display text-[15px] font-semibold text-ink` — “Add a companion”
- Fields → `Input` (Full name required, Relationship, Date of birth `type="date"`)
- Submit → `Button type="submit"` **primary ember** (fix ink fill)
- Disabled when `isLoading || !fullName.trim()`
- Error alert: keep string below

### 5.5 Microcopy (exact)

**Profile**

| Key | String |
|---|---|
| Title | `Your profile` |
| Subtitle | `Keep this current so Ava books your seat and meal exactly how you like it.` |
| Save | `Save changes` |
| Saving | `Saving…` |
| Success | `Saved` |
| Fetch error title | `Couldn’t load your profile` |
| Fetch error description | `Please try again shortly.` |
| Save error | `Couldn’t save — please try again.` |
| Companions prompt | `Travelling with others?` |
| Companions link | `Manage companions` |

**Companions**

| Key | String |
|---|---|
| Back | `← Profile` |
| Title | `Companions` |
| Subtitle | `People you often book alongside — family, friends, colleagues.` |
| Empty title | `No companions yet` |
| Empty description | `Add someone below to book for them faster.` |
| List error title | `Couldn’t load your companions` |
| List error description | `Please try again shortly.` |
| Remove | `Remove` |
| Form title | `Add a companion` |
| Full name | `Full name` / placeholder `Jane Doe` |
| Relationship | `Relationship` / placeholder `Spouse, child, friend…` |
| DOB | `Date of birth` |
| Submit | `Add companion` |
| Adding | `Adding…` |
| Add error | `Couldn’t add that companion — check the details and try again.` |
| Row fallback meta | `No details on file` |

### 5.6 A11y

- All fields labeled via `Input`
- Success / error live regions
- Companions remove buttons: accessible name `Remove {fullName}`
- Date input: ensure label associated (Input handles)
- Focus management: after successful add, focus Full name (cleared) for rapid entry

### 5.7 Motion notes

- Profile/Add forms: `anim-scale` on Surface
- Companion list rows: stagger `anim-rise` 70ms on first paint
- Saved indicator: fade in 150ms

---

## 6. Cross-cutting implementation checklist

Frontend-engineer should tick these before calling the polish done:

- [ ] No hand-rolled form chrome on login/profile/companions — only `Input` / `Button` / `Surface`
- [ ] No `book-btn` class outside chat
- [ ] No ink-filled primary CTAs on traveller-core screens (ember only)
- [ ] Empty states use `EmptyState` (dashed), never frosted faux-cards
- [ ] Page titles use `PageHeader` on list/profile/companions
- [ ] Page-level loading uses skeletons, not Spinner/plain text
- [ ] Spinners only inside pending Buttons
- [ ] Error states offer **Try again** or **Log in** / **Back to…**
- [ ] Token utilities (`text-ink`, `bg-ember`, `border-line`) in new/edited classNames
- [ ] `StatusBadge` rebuilt on `Badge` tones
- [ ] SiteNav primary trio + More disclosure on narrow viewports
- [ ] One ember primary action visible per screen at a time
- [ ] `prefers-reduced-motion` respected for any new animation classes
- [ ] Keyboard + focus-visible verified on login, nav More, trip cards, profile save

---

## 7. Explicit non-goals

- No chat hero redesign
- No new color/font/shadow tokens
- No dark mode
- No full mobile nav drawer / bottom tab bar (More disclosure is enough for this pass)
- No Skeleton primitive in `components/ui` required for v1 (colocate; extract later if vault/etc. adopt the same API)
- No booking mutation actions on trip detail (read-only history remains)

---

## 8. Handoff

**Implement in this order** (dependency-friendly):

1. Shared: StatusBadge → Badge; skeleton recipes; error EmptyState+retry helper pattern  
2. LoginForm + login Suspense fallback  
3. ProfileForm + Profile page PageHeader  
4. Companions list/form alignment  
5. TripList + Trips page PageHeader + TripDetail  
6. SiteNav More disclosure (highest interaction risk — ship after forms stable)

**Spec owner:** ui-ux-designer  
**Build owner:** frontend-engineer  
**Motion follow-up:** animation-engineer (notes in §§1.8, 2.8, 3.9, 4.10, 5.7)
)

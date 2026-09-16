# Component usage notes

Primitives live in `components/ui/` and are exported from the barrel at
`components/ui/index.ts` — `import { Button, Input } from "@/components/ui"`. Each file is
self-contained (≤200 lines), consumes tokens from `app/globals.css` only, and takes no new
dependency (there's a tiny local `cn()` helper in `utils/cn.ts` instead of `clsx`).

These are **global** primitives per dev guide §1.2 ("used by ≥2 routes"). Page-specific
composites (a `TripCard`, a `VaultDocumentRow`) belong colocated under that page's
`components/`, built *from* these primitives — they don't belong in `components/ui/`.

---

## Button

`components/ui/Button.tsx`

Four variants, two sizes. `type="button"` by default — pass `type="submit"` explicitly on
the one submit button in a form.

| Variant | Looks like | Use for |
|---|---|---|
| `primary` (default) | Emerald fill, void text, soft glow | The one primary action on a screen: book, send, confirm, save |
| `secondary` | Glass fill, cream text, line border | Everything else that's a real action but not *the* action |
| `ghost` | No fill/border, slate text | Low-emphasis actions (log out, cancel, dismiss) |
| `danger` | Desaturated red via `color-mix`, cream text | Destructive/irreversible actions (delete, cancel booking) |

```tsx
import { Button } from "@/components/ui";

<Button onClick={confirmBooking}>Confirm booking</Button>
<Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
<Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
<Button variant="danger" onClick={onDelete}>Delete traveller</Button>
```

- Sizes: `sm` (h-8, list rows / inline actions) and `md` (h-10, default form/page actions).
  There's no `lg` — if something needs to be louder than `md` `primary`, that's a copy or
  hierarchy problem, not a bigger button.
- `icon` prop takes a leading inline SVG sized via `1em` — pass it already-colored with
  `currentColor` strokes so it inherits the button's text color.
- `disabled` drops to `opacity-40` and blocks pointer events — don't also gray the label
  text manually.
- Focus ring is `signal-bright` (`focus-visible` only, so it never appears on mouse click)
  — this is the one required a11y treatment per the dev guide; don't override
  `focus-visible:ring-*` away on a one-off `className`.
- This does **not** replace the bespoke chat `send-btn` (icon-only, embedded in the
  composer pill) or `book-btn` (embedded in `OfferCardView`, needs the card's own
  hover choreography) — those stay hand-styled. Use `Button` for ordinary page/form/dialog
  actions.

## Input / Textarea

`components/ui/Input.tsx`, `components/ui/Textarea.tsx`

Standard labeled field with optional `hint` or `error` text (mutually exclusive — `error`
wins if both are passed). Both forward `ref` and spread native props, so they work directly
as a form library's registered field.

```tsx
import { Input, Textarea } from "@/components/ui";

<Input label="Email" type="email" placeholder="you@example.com" />
<Input label="Passport number" error={errors.passport} {...register("passport")} />
<Textarea label="Notes for the consultant" hint="Optional — visible to the human agent." />
```

- These are the plain-form field chrome (login, profile, traveller details, corporate
  approvals). They are **not** the chat composer — that's a bespoke borderless frosted
  pill with an embedded send button, defined inline in `ChatLayout.tsx`, and it stays that
  way; don't try to reuse `Input` there.
- Error state switches the border to `ember` and renders the message in `ember` — this is
  the one place `ember` is used for something other than a primary CTA (it doubles as the
  system's only "alert" color; see README "no new colors").
- Always pass `label`. If a field must be visually label-less, pass `aria-label` via the
  spread props instead of omitting labeling entirely.

## Select

`components/ui/Select.tsx`

Native `<select>` sibling of `Input`/`Textarea` — same field chrome (label, hint, error).
Not part of the original four-primitive form set, but added alongside it: `/vault` and
`/groups` already need an enum picker (document type, group type) and there's no reason
for that to be a bespoke unstyled `<select>` when the rest of the form uses `Input`.

```tsx
<Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
  <option value="passport">Passport</option>
  <option value="visa">Visa</option>
</Select>
```

- Also re-exported from `components/ui/Input.tsx` (in addition to the barrel) since a
  couple of call sites import it as `Input`'s natural neighbor — both `import { Select }
  from "@/components/ui"` and `from "@/components/ui/Input"` work.

## Badge

`components/ui/Badge.tsx`

Status pill, five tones — but only **three color families** (see
`docs/design/README.md`'s "no new colors" rule): `neutral`/`info` are the `ink` family,
`positive` is the `signal` family, `warning`/`danger` are the `ember` family. Modeled
directly on the offer-card angle label (`ANGLE_LABEL`/`font-display` uppercase treatment)
and the "Connected to a human agent" pill in `EscalateControl`.

| Tone | Family | Meaning |
|---|---|---|
| `neutral` (default) | ink | Quiet metadata — draft, archived, informational |
| `info` | ink | In-progress — submitted, under review |
| `positive` | signal | Confirmed, active, on-time, earned |
| `warning` | ember (soft) | Attention — expiring soon, low inventory |
| `danger` | ember (solid) | Most severe — expired, failed, destructive outcome |

```tsx
<Badge tone="positive" dot>Confirmed</Badge>
<Badge tone="warning">Expiring soon</Badge>
<Badge tone="danger">Expired</Badge>
<Badge>Draft</Badge>
```

- `dot` renders a small solid `currentColor` dot before the label — reserve it for
  genuinely live/status badges (matches the online-status dot pattern in `ChatLayout`),
  not every badge.
- `danger` is the one tone rendered as a **solid fill** rather than a soft/outline pill —
  that's deliberate, so the most severe state visually outranks the other four at a
  glance (used for "Expired" in the vault, for example).
- Used across `/vault`, `/visa`, `/rewards`, `/journey`, `/groups`, `/mice`.

## PageHeader

`components/ui/PageHeader.tsx`

Route-level title block: `title` (required), optional supporting line, optional
right-aligned actions slot (typically one or two `Button`s). The supporting-line and
actions props each have two accepted spellings — pick one per call site, don't pass both:

| Prop | Alias | Meaning |
|---|---|---|
| `subtitle` | `description` | Supporting line under the title |
| `actions` | `action` | Right-aligned slot |

```tsx
<PageHeader
  title="Trips"
  subtitle="Everything booked and in progress."
  actions={<Button size="sm">New trip</Button>}
/>

// equivalent, singular-alias spelling used by /groups, /mice, /corporate:
<PageHeader title="Rewards" description="Track your points, tier, and referral activity." />
```

- This is for the `(traveller)` / `(ops)` / `corporate` route pages. The chat page
  (`app/page.tsx`) has its own `BrandMark` inside `ChatLayout` and does not use
  `PageHeader` — don't retrofit it there.

## EmptyState

`components/ui/EmptyState.tsx`

Zero-state for lists/tables/search results: `title` (required), optional `description`,
optional leading `icon`, optional `action` (usually a `Button`).

```tsx
<EmptyState
  title="No trips yet"
  description="Ask Ava for a flight or search a destination to get started."
  action={<Button size="sm" onClick={goToChat}>Start a chat</Button>}
/>
```

- Deliberately plain: a dashed `line` border, no frosted `Surface` treatment. An empty
  state is not "content," so it shouldn't compete visually with real content once loaded.

## Surface

`components/ui/Surface.tsx`

The frosted-glass panel material — generalizes the chat bubble / offer-card / typing-dots
treatment (`bg-[var(--surface)]` + `border-line` + `backdrop-blur-md` +
`shadow-[var(--shadow-soft)]`) for reuse outside the chat.

```tsx
<Surface padding="lg">
  <form>...</form>
</Surface>

<Surface interactive padding="md" as="button" onClick={select}>
  Selectable option card
</Surface>
```

- **Use for interactive containers only** — a form panel, a selectable card, a
  status/action card. `interactive` adds the offer-card hover lift
  (`translateY(-2px)` + border tint on hover) — only set it on something clickable.
- **Do not** reach for `Surface` as a generic "give this a card look" wrapper around
  static/decorative content (a stat, a paragraph, a page section). That's the #1 way this
  primitive gets overused into "every dashboard tile is a translucent card" — which is
  exactly the genericized-AI-dashboard look this system is trying to avoid. Prefer flat
  content on `bg-paper` unless the content is actually interactive.
- `as` lets you render it as a `button`/`article`/etc. when the whole panel is the
  interactive target (pairs with `interactive`).

## Spinner

`components/ui/Spinner.tsx`

Plain loading indicator — `signal`-colored ring, `sm`/`md` sizes, `role="status"` with a
visually-hidden label.

```tsx
<Button disabled={isSaving}>
  {isSaving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : "Save"}
</Button>
```

- This is the everywhere-else spinner (button pending state, a loading page section). The
  chat's own "Ava is typing" indicator is the richer, bespoke `TypingDots` (radar-ring +
  three-dot wave) — don't replace that with `Spinner`, and don't reuse `TypingDots` outside
  chat; they serve different registers.
- Already respects `prefers-reduced-motion` (`motion-reduce:animate-none`) — no extra work
  needed at the call site.

---

## Adding a new primitive

Before adding one, check: is it used (or clearly about to be used) by **two or more
routes**? If it's specific to one page's feature, it belongs colocated under that page's
`components/`, not here (dev guide §1.2's litmus test applies to `components/ui/` too).

When you do add one:

1. Consume `app/globals.css` tokens only — no new hex values, no new CSS vars, unless you
   first add the token to `globals.css` and document it in `README.md`'s color table.
2. Keep it ≤200 lines; split sub-pieces out if it grows past that.
3. Default to accessible primitives: real `<button>`/`<label>`/`<input>`, explicit
   `type="button"` where relevant, visible `focus-visible` rings using `signal`/
   `signal-bright`, and `aria-*` wiring for error/hint text.
4. Export it from `components/ui/index.ts` and add a section here.

# Earth Odyssey Design System

**Status: this is the source of truth.** `docs/DEVELOPMENT_GUIDE.md` §0 points here.

This system supersedes the previous FlightOne ink/paper/ember / sky-stage language.
Extend these tokens — do not fork a parallel palette.

## Brand voice

Earth Odyssey is a **cinematic luxury expedition brand** with an AI travel consultant
(Ava) as the booking front door. The UI should feel dark, fluid, and precise — never
like a consumer OTA or a flat admin console.

- **Deep void:** default surface is `#08080A`. Depth comes from emerald glows and glass,
  not stacked borders.
- **Emerald glass CTAs:** `#00FF87` is the one saturated action color — book, send, begin.
- **Muted slate:** secondary copy and meta (`#8A8F9E`).
- **Soft cream text:** primary type on void (`#F4F4F6`), never pure white glare.
- **Quiet luxury copy:** short, declarative, expedition-minded.

## Color tokens

Defined in `app/globals.css`. Legacy utility names are **aliased** to EO values so existing
`text-ink` / `bg-paper` / `bg-ember` classes keep compiling.

| Token | Hex | Legacy alias | Use |
|---|---|---|---|
| Void | `#08080A` | `--paper` | App background |
| Cream | `#F4F4F6` | `--ink` | Primary text |
| Slate | `#8A8F9E` | `--ink-soft` | Secondary text |
| Emerald | `#00FF87` | `--ember`, `--signal` | Primary CTA, live/focus |
| Elevated | `#12141A` | `--paper-elevated`, `--surface-solid` | Fields, solid panels |
| Glass | `rgba(244,244,246,.06)` | `--surface` | Frosted panels |
| Line | `rgba(244,244,246,.12)` | `--line` | Hairlines |

Prefer Tailwind utilities (`text-ink`, `bg-ember`, `border-line`) or new EO names
(`bg-void`, `text-cream`, `bg-emerald`) when mapped.

## Typography

- **Display — Cormorant Garamond** (`font-display`): page titles, hero, brand wordmark.
- **Body — Figtree** (`font-sans`): forms, chat, tables.
- **Mono — JetBrains Mono** (`font-mono`): kickers, micro-labels, nav meta.

## Spacing & radius

Unchanged Tailwind scale. Chat slightly tighter (`gap-2`–`gap-3`); page layouts `gap-4`–`gap-6`.
Radius: `rounded-lg` / `xl` / `2xl` / `full`; chat bubbles use `--radius-msg`.

## Motion

- Entrances: `.anim-rise`, `.anim-fade`, `.anim-scale` with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Micros 150–300ms; transform/opacity only.
- Marketing `/` may use Lenis + Framer Motion; app boards stay restrained.
- Always honor `prefers-reduced-motion`.

## Page shell

Use `.sky-stage` or `.eo-stage` for void atmosphere (same styles). Do **not** add light
sky orbs for decoration — emerald blurs only.

## Do / Don't

**Do**

- Reuse `components/ui/*` primitives.
- Emerald only for the primary action on a screen.
- Glass `Surface` for interactive panels.

**Don't**

- Don't reintroduce cream/terracotta agency looks or purple gradients.
- Don't mount the WebGL globe on traveller/ops routes — landing `/` only.
- Don't put Lenis on chat or dense forms.

## See also

- [`components.md`](./components.md) — primitive usage.
- `app/globals.css` — token definitions.
- `/earth-odyssey` redirects to `/` (cinematic landing).
- `/chat` — Ava consultant (Module 01).

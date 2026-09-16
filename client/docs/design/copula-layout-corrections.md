# Copula Homepage — Layout Corrections (Live Audit)

**Source:** [https://copula.agency/](https://copula.agency/)  
**Audited:** 2026-07-27 via cursor-ide-browser + CDP `Runtime.evaluate`  
**Viewports used:** ~892×458 (default), then `Emulation.setDeviceMetricsOverride` 1440×900  
**Mirror under audit:** `app/(mirror)/mirror/copula/`  
**Companion tokens/type:** see `copula-agency-audit.md` (colors/type still valid; several layout notes there are superseded by this file)

This doc is a **buildable layout recipe**. Prefer these measurements over the mirror’s current structure.

---

## Top 5 mismatches vs current mirror

1. **Manifesto** — Live is SVG `<textPath>` on a curved path + second-layer centered `h2`, with `OUR MANIFESTO` + spinning asterisk eyebrow. Mirror only CSS-rotates flat “THE BOND…” text; missing eyebrow and phase-2 copy.
2. **Services** — Live titles are **Performance & Growth / CREATIVE SOLUTIONS / Digital Presence** with real WebP icons on the **right** (`lg+`) and border pills. Mirror uses wrong titles (Brand & Creative / Digital Experiences), fake orange circle, and invented pills.
3. **Mid CTA** — Live is a full orange **stadium** (`md:rounded-[150px]`) with long copy + blue squircle CTA. Mirror is a plain cream flex row with truncated “Ready when you are…”.
4. **Featured Work** — Live titles are right-aligned display; expand reveals copy+pills + **`work-wavy-box`** masked case image. Mirror uses left-aligned accordion with crude color blocks.
5. **About + Footer** — About is a **600vh** sticky orange-circle takeover with letter-reveal body + wavy photo collage (not static cream cards). Footer is **`bg-almost-black`** with etymology + `h1` nav + orange CTA (not a blue blob).

---

## Global chrome (header)

### Structure
- `nav[aria-label="Main Navigation"]` — `absolute inset-x-0 top-0 z-40 h-[var(--nav-height)]`
- Row: wordmark (left) | desktop menu cluster (right, `hidden md:flex`)
- Hairline: `border-b` on the nav row (`border-copula-white` / dark theme swap)
- Tagline **“New name, same Degordian DNA”** lives in the **header**, not the hero:  
  `absolute top-[100%]` under the nav (`hide-on-slide-in`)

### Desktop nav links — when they show
- Links **About / Blog / Work / Contact** exist in the DOM as white pills (`rounded-[30px]`, `min-w-30`, `bg-copula-white`).
- **Default closed state:** each `<li>` has inline `opacity:0; transform:translateY(100%)` — **not visible**.
- **Always visible on `md+`:** circular **+** button only (`size-8.5`, cream fill, orange plus; `absolute … left-[100%] translate-x-[-100%]`).
- Opening the menu slides pills in (opacity → 1, translateY → 0). They are **overlay/expand chrome**, not a persistent desktop nav bar.
- Mobile: separate `md:hidden` round button.

### Theme
- `data-theme="light|dark"` on nav; menu button + wordmark swap via `group-data-[theme=dark]:*`.

---

## 1. Hero (orange)

### Container
```
section.bg-copula-orange.text-copula-white
  .flex.h-svh.min-h-163.w-full.items-end
  .px-(--padding-x).py-(--padding-x)
```
- BG: `#FC5100`
- Content **bottom-aligned** (`items-end`), full `100svh` (min ~652px at short viewport)
- Tagline is **not** inside this section (see header)

### Typography / CTA structure (exact)
```
div.flex.flex-col
  h1.display.flex.flex-col   →  "Your" + rotating word (letter spans)
  div.flex.flex-col.items-baseline.md:flex-row.md:items-center
    h1.display               →  " agency"  (leading space in DOM)
    div.flex.gap-x-5
      svg.asterisk.text-copula-blue.size-29.5.animate-spin  [10s]
      a.CTA.text-copula-blue  →  squircle blob + "Let's bond"
```

**Confirmed:** CTA is **inline with the “agency” row** on `md+` (`md:flex-row md:items-center`). Asterisk is **blue**, continuously spinning. Rotating words observed: `creative`, `branding`, `digital`, `all-in-one` (cycle).

### CTA geometry
- Squircle SVG (8-lobed organic path), `min-h-32 min-w-32` (~128×128)
- Hover: `scale-105` + `rotate-45` over 1000ms on the shape SVG

---

## 2. Manifesto sticky (blue)

### Track + pin
| Property | Value |
|---|---|
| Track | `section.relative.h-[400vh].md:h-[500vh]` |
| Sticky panel | `div.bg-copula-blue.sticky.top-0.h-[100vh].w-full.items-center.overflow-hidden` |
| BG | `#0501DE` |

**Pinned:** the blue `100vh` panel sticks while the track scrolls (400–500vh of scroll runway).

### Layer A — eyebrow (always on sticky panel)
```
div.absolute.top-0.left-0.flex.items-center.gap-1.p-(--padding-x)
  svg.size-6.animate-spin [10s]   ← flower/asterisk (different path from hero)
  p.h3.uppercase → "Our manifesto"  (renders as OUR MANIFESTO)
```

### Layer B — curved headline (SVG textPath) — NOT CSS rotate
```
svg#Path.absolute.top-1/2.left-1/2.-translate-x-1/2.-translate-y-1/2
  w-[200%] md:w-full
  path#MyPath d="M0.34 163.94 C224.22 39.56 496.45 39.56 720.34 163.94
                 C944.22 288.32 1216.45 288.32 1440.34 163.94"
  textPath#Text → "The bond behind brand success"
    class: font-headline uppercase text-[80px] md:text-[100px]
```

**Scroll progress mapping** (measured; `p = (scrollY - sectionTop) / (trackH - vh)`):

| p | `startOffset` | path style | h2 |
|---|---|---|---|
| 0.00 | `-80%` | opacity 1, transform none | opacity 0, `translateY(50px)` |
| 0.135 | `~-45.7%` | opacity 1 | hidden |
| 0.463 | `~37.3%` | opacity 1 | hidden |
| 0.736 | `~106.4%` | opacity ~0.11, `translateX(~177px)` | still 0 |
| ≥0.90 | `110%` | opacity 0, `translateX(200px)` | opacity 1, transform none |

Approx formula for path travel (fits samples):  
`startOffset% ≈ clamp(-80 + p * 253.3, -80, 110)`  
Then path fades + slides right; **phase-2 copy fades up**.

### Layer C — second copy (replaces curve)
```
h2.h1.absolute.top-1/2.left-1/2.-translate-x-1/2.-translate-y-1/2
  .w-full.max-w-310.px-(--padding-x).text-center.uppercase
```
Copy (exact):

> We bring strategy, creativity, and agile approach together to help brands connect with people, and turn that connection into real results.

**Mirror fix:** replace CSS `rotate()` block with sticky track + textPath scrub + h2 crossfade + eyebrow.

---

## 3. Services

### Shell
```
section.relative.px-(--padding-x).py-5
  eyebrow: asterisk + "SERVICES" (h3 uppercase)
  div.mx-auto.max-w-292.5.flex.flex-col.lg:flex-row
       .items-center.justify-between.gap-10.py-5.md:py-19
```

### Grid (desktop `lg+`)
| Column | Role | Classes / size @1440 |
|---|---|---|
| Left | Accordion | `flex.max-w-181.flex-col` (~724px wide, left ~135) |
| Right | Service icon | `relative.aspect-square.max-w-94.hidden.lg:block` (~376×376 at left ~929) |

**Image position:** **right** on `lg+`. Below `lg`, square icon is **inside** the open accordion panel (`max-w-37.25 lg:hidden`).

### Accordion behavior
- Radix vertical accordion; **one open** (Performance open by default on load)
- Open title: `group-aria-expanded:text-copula-orange` (orange)
- Closed titles: light grey (`text-light-grey`)
- Panel: description `p` + `flex.flex-wrap.gap-3` pills + (mobile) icon

### Exact titles, copy, pills (live)

**1. Performance & Growth**  
Desc: *We track, measure, and optimize to ensure lasting results.*  
Pills: Digital advertising strategy · Analytics & reporting · Campaign tracking & optimization · Conversion rate optimization (CRO) · SEO · Email marketing · Web design & development  
Icon: `…/media/Performance%20%26%20growth%20icon.webp`

**2. CREATIVE SOLUTIONS**  
Desc: *We help you define who you are, what you stand for, and how to express it.*  
Pills: Brand identity · Social media presence strategy · Creative concepts · ATL & OOH campaigns · Integrated campaigns  
Icon: `…/media/Creative%20solutions%20icon.webp`

**3. Digital Presence**  
Desc: *We connect your brand with the right audience through meaningful digital content.*  
Pills: Social media management · Content creation · Community management · Influencer marketing · Digital campaigns · Online & offline activations  
Icon: `…/media/Digital%20presence%20icon.webp`

### Pill styling
```
span.border-dark-grey.smallBody.rounded-[200px].border.p-2.5
```
Transparent fill, `1px solid #464645`, fully rounded.

### Orange graphic
**Not a CSS circle.** Square `object-cover` WebP icon that swaps with the open accordion item. Right column on desktop.

---

## 4. Mid CTA — “Ready when you are”

### Shell
```
section.flex.w-full.flex-col.items-center.justify-center.gap-6
       .px-(--padding-x).py-14
  div.bg-copula-orange.mx-auto.w-full.max-w-292.5
      .flex.flex-col.md:flex-row.items-center.justify-between
      .gap-6.md:gap-18.5
      .rounded-[22px].md:rounded-[150px]
      .p-4.pt-10.md:p-8.75
```

| Piece | Spec |
|---|---|
| Shape | Stadium / pill capsule on `md+` (`border-radius: 150px`) |
| BG | `#FC5100` |
| Copy | `p.h2.text-copula-white` — **full sentence:** “Ready when you are. Reach out and see what happens when the right minds connect” (`max-md:text-center`, `md:pl-12`) |
| CTA | Blue squircle “Let’s bond” (same blob component; sr text “Contact us”) |

**Mirror fix:** replace cream split row with this orange stadium block.

---

## 5. Featured Work accordion

### Shell
```
section#work.relative.p-(--padding-x)
  eyebrow: asterisk + "FEATURED WORK"
  Radix accordion (all items start collapsed)
```

### Trigger row
```
button.flex.w-full.items-center.justify-between.gap-2
  svg.arrow (left)  — opacity 0 → 100 on hover/open; rotates when open
  h2.display.text-light-grey  — huge, effectively right-weighted
  svg.arrow (right) — same visibility rules
```
Titles (exact): **Leerdammer** · **Minores** · **DM DROGERIE MARKT B&H**

### Expanded panel (`md:flex-row`, `items-end`)
```
div.flex.flex-col.items-end.gap-10.md:flex-row
  div.flex.w-full.flex-col.gap-6.md:max-w-82
    p.smallBody  (case summary)
    div.flex.flex-wrap.gap-2.5  (pills, same chip style as services)
  a.work-wavy-box.aspect-[3/2].w-full.max-w-170
    img.object-cover  (hover scale-105)
```

**Leerdammer pills (live):** Social Media · Influencer Marketing · Creative Concepts · Digital Advertising · Creative Campaigns · Copywriting · Graphic Design

### Media appearance
- Class **`work-wavy-box`**: CSS **mask** with radial scallops (wavy left/right edges), not a rectangle or circle.
- Aspect `3/2`, max width ~680px @1440, linked to `/work/{slug}`.

---

## 6. Clients

### Eyebrow
Asterisk + **OUR CLIENTS**

### Headline treatment (missing O)
```
p.display.text-dark-grey.whitespace-pre-line
  "When the \nC" +
  span.inline-block.w-70.md:w-155
    svg.text-copula-orange  viewBox="0 0 623 147"   ← decorative O glyph
  "nnection\nis real, it shows"
```
Accessibility text reads “When the C nnection…” — the **O is an orange SVG**, not a letter/dot.

### Logos
- Horizontal **marquee / Embla-style** track (`overflow-hidden`, duplicated logo set for loop)
- Real client WebPs (dm, dr.oetker, eronet, lactalis, wiener, mepas, hp mostar, elektro milas, heineken, holdina, …)
- Spacing: `--slide-spacing` grows on `md`

### Score block
- Image alt `Clients Score Image` (photo asset, not a plain “98” circle)
- Sits with the headline in `relative.py-8.md:p-20`

**Mirror fix:** replace orange CSS circle “O” + text marquee placeholders with SVG-O + logo track + score image treatment.

---

## 7. About sticky — photo collage

### Track + pin
| Property | Value |
|---|---|
| Track | `div.relative.h-[600vh]` inside `section.relative` |
| Sticky | `div.sticky.top-0.h-[100vh].w-full.overflow-hidden` |
| Eyebrow | white asterisk + **ABOUT US** (`absolute top-0 left-0 z-10`) |

### Scroll choreography (from DOM + mid-scroll screenshots)
1. **Orange circle takeover:** two tall orange circle SVGs (`h-[300vh]`, centered) animate from `translateY(-100%)` / `translateY(100%)` into the sticky viewport → fills sticky with orange.
2. **Title phase:** centered `h2.display` white, `whitespace-pre-line`:
   ```
   Nice to 
   bond 
   with you
   ```
3. **Body phase:** second absolute layer starts at `transform:translateY(100%)`, slides up; body is **letter-by-letter** spans (opacity scrub from ~0.5→1) — “We're thinkers, makers, and doers, coffee lovers (mostly all), food obssessed, …”
4. **Photos:** three stacked `wavy-box` frames `absolute right-5 bottom-5 aspect-square max-w-37.5 md:max-w-65` with real portraits (`homepage-edina/iva/katja.webp`). Initial wrapper transform includes `translateY(50)` — they settle as scroll progresses.
5. CTA link **BOND MORE WITH US** appears in this chapter.

**Mirror fix:** replace cream 2-col static cards with 600vh sticky + circle wipe + letter reveal + wavy photo stack.

---

## 8. News

```
section.bg-copula-blue.relative.pt-4.pb-6.md:py-10
  eyebrow centered on md: asterisk + LATEST NEWS
  h2 centered white intro
  md:grid.md:grid-cols-3 (mobile: horizontal snap scroll)
```

Cards:
- `a.wavy-box.aspect-square` image (mask scallops)
- Meta: Blog · categories
- Title
- “READ BLOG” / section “SEE MORE”

BG: `#0501DE` (same blue as manifesto).

---

## 9. Footer — etymology + shape

### Container
```
footer.text-copula-white.bg-almost-black
  bg ≈ #242424 (rgb 36,36,36)   ← NOT blue
  px-5 py-10 md:px-(--padding-x) md:pb-6
```

### Top grid (`lg:grid-cols-2`)
**Left**
- Large wordmark SVG
- Etymology block:
  - `h4`: `[koh-poo-la] noun ● latin`
  - Body: “The word *copula* derives from the Latin word *copulare* meaning a "link", / "bond", "connection" or "tie" that connects two different things.”
  - Orange emphasis on italic *copula* / *copulare* (`#FC5100`)

**Right**
- Vertical `h1` links: About · Blog · Work · Contact
- Orange squircle **Let’s bond** CTA (`text-copula-orange`)

### Bottom bar
- “Developed and designed by Builtt, 2026…”
- Socials + Terms / Privacy / Cookie policy

**There is no large blue blob in the live footer.** Blue belongs to manifesto + news. Mirror’s “flat blue blob” is incorrect; use almost-black + etymology + display nav + orange CTA.

---

## Component cheat-sheet (reuse)

| Component | Live classes / notes |
|---|---|
| Section eyebrow | spinning 25×25 asterisk SVG + `p.h3.uppercase` |
| Bond CTA | organic SVG blob + `h4` label; blue or orange via `text-copula-*` |
| Chips | `rounded-[200px] border border-dark-grey p-2.5 smallBody` |
| Wavy media | `.wavy-box` / `.work-wavy-box` CSS masks (radial scallops) |
| Cursor | lavender disc `#AEB8FF` |
| Awwwards | fixed right tab `w.` + vertical “Honors” |

---

## Recommended mirror rebuild order

1. Manifesto sticky (textPath + phase-2 + eyebrow) — highest visual miss  
2. Services titles/pills/right icon  
3. Mid CTA stadium  
4. Work wavy accordion  
5. About 600vh sticky collage  
6. Clients SVG-O + logo marquee  
7. Footer almost-black etymology  
8. Header: hide pills until + opens (tagline under nav)

---

## CDP snippets (first ~chars of key sections)

### Hero (structure)
```html
<section class="bg-copula-orange text-copula-white flex h-svh min-h-163 w-full items-end px-(--padding-x) py-(--padding-x)">
  <div class="flex flex-col">
    <h1 class="display flex flex-col …">Your <!-- rotating word --></h1>
    <div class="flex flex-col items-baseline md:flex-row md:items-center">
      <h1 class="display …"> agency</h1>
      <div class="flex gap-x-5"><!-- blue spin asterisk + Let's bond CTA --></div>
    </div>
  </div>
</section>
```

### Manifesto sticky core
```html
<section class="relative h-[400vh] md:h-[500vh]">
  <div class="bg-copula-blue text-copula-white sticky top-0 flex h-[100vh] w-full items-center overflow-hidden">
    <div class="absolute top-0 left-0 flex items-center gap-1 p-(--padding-x)">
      <!-- spin asterisk --><p class="h3 uppercase">Our manifesto</p>
    </div>
    <div class="absolute inset-0 flex …">
      <svg id="Path">…<textPath id="Text" startOffset="-80%">The bond behind brand success</textPath></svg>
      <h2 class="h1 absolute … uppercase" style="opacity:0;transform:translateY(50px)">We bring strategy…</h2>
    </div>
  </div>
</section>
```

### Mid CTA
```html
<section class="flex w-full flex-col items-center … py-14">
  <div class="bg-copula-orange … rounded-[22px] md:rounded-[150px] md:flex-row …">
    <p class="h2 text-copula-white">Ready when you are. Reach out and see what happens when the right minds connect</p>
    <!-- blue Let's bond CTA -->
  </div>
</section>
```

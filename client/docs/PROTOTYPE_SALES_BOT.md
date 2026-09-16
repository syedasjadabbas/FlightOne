# Prototype — AI Sales Consultant (chat)

A single-page chat prototype that proves the conversion logic for the AI Travel
Consultant. The **UI is throwaway**; the value is the reusable `lib/` core, which
is structured to map onto the PRD modules so it can be lifted into the full
platform.

## Run it

```bash
npm run dev          # http://localhost:3000
```

Works with **no configuration** — it falls back to a deterministic template
composer. For real conversational replies, copy `.env.example` → `.env.local`
and set a Gemini key and/or point at LM Studio’s local server.

## LLM providers (`lib/llm/`)

Ordered fallback chain controlled by `LLM_PROVIDER` (`auto` | `gemini` | `lmstudio`
| `off`):

1. **Gemini** (REST, no SDK) — `GEMINI_API_KEY`, `GEMINI_MODEL`.
2. **LM Studio** (OpenAI-compatible) — `LMSTUDIO_BASE_URL`, `LMSTUDIO_MODEL`.
3. **Template composer** — if every provider fails/none configured, a
   deterministic pitch is generated so the bot never dies.

Whatever answers, the offer prices shown to the customer are always the
server-computed ones — the model only ever phrases them.

## The pipeline (`lib/consultant/orchestrator.ts`)

```
message
  → intent extraction        (intent.ts — slot-filling: type/route/budget/cabin/stars)
  → close-intent check       (close.ts — "book it" → courtesy hold, AI never books)
  → retrieval (never empty)   (inventory.ts — exact + graceful widening)
  → pricing                  (pricing.ts — net → customer price, margin, AI floor)
  → curation (top-3)         (recommendation.ts — best-value / cheapest / fastest)
  → grounded reply           (prompt.ts persona + LLM, or template fallback)
```

### The "don't let them walk" logic

This is the core sales behaviour the brief asked for:

- **Exact ask has a price edge** → pitch it, lead with the saving vs Booking.com.
- **Exact ask is at price parity** with the OTAs → keep the ask but blend in
  same-category alternatives where we *do* beat the market.
- **We don't have the exact thing** (e.g. a specific 5★ hotel) → pivot to the
  best available option **in the same category** — never a dead-end "sorry", and
  never a jarring cross-category jump (no flight when they asked for a hotel).

Cross-category cross-sell only happens as a last resort when we have nothing in
the requested category for that destination.

## Module mapping (see `docs/modules/`)

| Prototype file                    | PRD module                          |
| --------------------------------- | ----------------------------------- |
| `lib/consultant/*`                | 01 — AI Travel Consultant           |
| `lib/inventory/*`                 | 03 — Booking Engine (supplier data) |
| `lib/recommendation/*`            | 04 — Recommendation Engine          |
| `lib/pricing/*`                   | 05 — Pricing & Margin Engine        |
| `types/money.ts`, `utils/money.ts`| dev guide §5 (money conventions)    |

## Seed data (`lib/inventory/inventory.data.json`)

600 offers (336 flights, 192 hotels, 72 packages) over real city pairs and
airline / hotel brands with plausible USD fares, spanning all 16 seeded cities
(every city has hotel coverage). **Generated, not scraped** — scraping
Booking.com / Trip.com violates their ToS and would be unstable. Each offer
carries a `marketPrice` (a realistic OTA reference) so the value pitch has
something concrete to compare against; offers are tagged `beatable` / `parity`
/ `premium` (roughly 50/30/20%) so the pivot logic gets a real mix to work
with.

Regenerate deterministically:

```bash
node scripts/generate-inventory.mjs
```

When real supplier adapters land, only `lib/inventory/inventory.ts` changes — the
rest of the pipeline codes against the `Offer` type, not the data source.

## Known prototype shortcuts (production TODO)

- Conversation state is local React state; the dev guide (§2) wants the Zustand
  conversation store, and server-side persistence (Module 01: resumable threads).
- Intent extraction is heuristic/deterministic. Fine for retrieval; a real NLU /
  LLM slot-filler slots in behind the same `ExtractedIntent` contract.
- No auth (`proxy.ts`), no RTK Query, no design system — all deliberately out of
  scope for a logic prototype (see dev guide §0 "throwaway scaffolding").
- "Book this" places a simulated hold only. Real booking/payment is Module 03/05.

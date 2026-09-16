# Module 05 — Pricing & Margin Engine

**PRD Module 5** · Prefix: `PRC` · Phase: 1

**Status: MODULE 5 COMPLETE** (in-scope Phase 1). Deferred items below are
cross-module dependencies or explicit out-of-scope work — not open Module 5
implementation stages.

## Objective (from PRD)

Turn a supplier net fare into a final customer-facing price: dynamic markups, negotiation
buffers, promotional discounts, corporate pricing, agent permissions, AI discount limits,
and profitability reporting.

## Dependencies

- Module 03 (calls this engine at quote, reserve, and payment-capture time)
- Module 06 (corporate-specific pricing rules)
- Module 17 (profitability reporting consumes this module's margin data)

## Core concepts

- This is the **single source of pricing truth** — Module 03 must call it at every step
  (quote → reserve → pay) rather than caching/reusing a price computed earlier in the flow
  (dev guide §4: "a stale cached fare is a customer-facing bug").
- Money is integer minor units + explicit currency end-to-end (dev guide §5) — no floats.

## Checklist

### Fare composition
- [x] Supplier net fare ingestion (per Galileo/RateHawk adapter output)
- [x] Dynamic markup rules (by route, supplier, cabin, season, or customer segment) — route/supplier/cabin/segment implemented; **season deferred** (see Remaining gaps)
- [x] Negotiation buffer (room for AI/agent-led discounting within a bounded range)
- [x] Promotional discount codes/campaigns, with validity windows and usage limits
- [ ] Corporate-specific pricing (negotiated rates per company — Module 06) — hook only; see Remaining gaps
- [x] Multi-currency support: net fare currency, display currency, settlement currency all
      tracked explicitly — conversion fail-closed without trusted FX

### Permissions & limits
- [x] Agent discount permission levels (max discretionary discount per agent tier) — RBAC keys `pricing:discount:{junior|standard|senior}` + PricingConfig BPS ceilings; server-enforced on quote/reprice/booking
- [x] AI discount limits — a hard ceiling the AI Booking Engine cannot exceed without human
      escalation (Module 13)
- [x] Server-side enforcement of all limits regardless of which client/AI initiated the
      request

### Repricing & consistency
- [x] Re-price on every booking-flow transition (quote/reserve/pay), not just once at search
      time
- [x] "Price changed" customer-facing flow when a reprice differs from the last shown price
- [x] Price quote TTL/expiry aligned to supplier quote validity

### Reporting
- [ ] Profitability reporting: margin per booking, per route, per supplier, per corporate
      account, aggregated in the DB (not loaded row-by-row into JS — dev guide §6.1)
- [ ] Feed into Module 17's management dashboard (revenue/margin widgets)

## Business rules / invariants

- Every priced amount carries its currency; conversions happen explicitly and are logged
  (audit trail for finance reconciliation).
- The AI Booking Engine can request a discount but cannot self-approve beyond its
  configured limit — exceeding it triggers Module 13 escalation, not a bypass.
- Margin/profitability aggregation is computed in the database (`groupBy`/`aggregate` or
  `$queryRaw`), never by loading raw booking rows into Node to sum in JS.

## Deferred / dependency items (not Module 5 follow-up stages)

These remain blocked or owned elsewhere. Do **not** open another Module 5
implementation prompt for them.

| Item | Owner / dependency |
| --- | --- |
| Season-scoped MarkupRules | Needs agreed season data model before schema/match semantics |
| Corporate negotiated rate tables | Module 06 — `companyMarkupBps` hook retained; no duplicate rate architecture here |
| Trusted FX provider | External FX source; pricing stays fail-closed without one |
| Profitability reporting / dashboard widgets | Module 17 |
| Predictive pricing | Phase 3 |

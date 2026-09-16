# Module 14 — Refund & Reissue Engine

**PRD Module 14** · Prefix: `RFD` · Phase: 1 (basic manual refund tracking, since Payment
Gateway ships in Phase 1) → 2 (automation)

## Objective (from PRD)

Calculate airline refund value, hotel refund value, supplier penalties, agency fees,
processing timelines, and travel credits; support refunds, exchanges, reissues, partial
refunds, schedule changes, and cancellation workflows.

## Dependencies

- Module 03 (the booking state machine this module transitions into `Cancelled`/`Refunded`)
- Module 05 (pricing engine — refund math must use the same fare/margin data as the
  original sale)
- Module 10 (reward reversal on refund)

## Core concepts

- Refund/reissue amounts are **deterministic and re-creatable from stored inputs** (dev
  guide §7) — never a manually typed final number with no formula behind it.
- This module reads the **original booking's fare rules and supplier penalty terms** — it
  cannot compute a correct refund without them, so fare-rule capture at booking time
  (Module 03) is a hard dependency, not an afterthought.

## Checklist

### Calculation
- [ ] Airline refund value calculation from fare rules + fare basis
- [ ] Hotel refund value calculation from RateHawk cancellation policy
- [ ] Supplier penalty calculation (change/cancellation fees per supplier terms)
- [ ] Agency fee application (FlightOne's own service fee, separate from supplier penalty)
- [ ] Processing timeline estimate (varies by airline/supplier)
- [ ] Travel credit issuance when cash refund isn't available/chosen

### Workflows
- [x] Full refund workflow
- [x] Partial refund workflow (e.g. one passenger of a multi-pax booking)
- [x] Exchange workflow (change flight/hotel, fare difference calculated; **REQUIRES_HUMAN** — no live GDS mutation; PRD requires calculate + support, not autonomous reissue)
- [x] Reissue workflow (same calculation + human servicing queue; ticket not auto-mutated)
- [x] Schedule-change handling (airline-initiated change — different rules than
      customer-initiated cancellation, typically no penalty)
- [x] Cancellation workflow (full booking cancellation, not just one component)

### Integration
- [ ] Refund/reissue transitions the Module 03 state machine explicitly (`Refunded`, not a
      side-table update)
- [ ] Reverses associated reward accrual (Module 10)
- [ ] Refund amount reconciled against original payment method (or issued as travel credit)
- [ ] All calculations logged with their inputs (fare rule, penalty %, fee) for audit —
      re-creatable, not just a final number

## Business rules / invariants

- A refund/reissue calculation must always be traceable back to the specific fare rule and
  supplier penalty term used — "why is this the refund amount" must be answerable from
  stored data, not tribal knowledge.
- Schedule-change-driven changes (airline's fault) must not charge the customer a penalty
  the way a voluntary cancellation would.
- Refund processing is idempotent — retrying a refund request must not double-refund.

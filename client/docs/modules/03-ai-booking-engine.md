# Module 03 — AI Booking Engine

**PRD Module 3** · Prefix: `BKG` · Phase: 1

## Objective (from PRD)

Search Galileo / Travelport TripServices (flights) and RateHawk (hotels), compare and rank
supplier results, apply margins, reserve inventory, process payment/approval, issue tickets
and vouchers, and push updates to mid/back office automatically. This is the transactional
core of the platform — every other module either feeds it (recommendations, pricing,
corporate policy) or reacts to it (vault, journey monitoring, refunds).

**Flights supplier research:** [integrations/travelport-tripservices.md](../integrations/travelport-tripservices.md)
(TripServices Flights v11 is the integration surface; Galileo 1G is the content host).
Candidate aggregator (research only): [integrations/tpconnects-iris.md](../integrations/tpconnects-iris.md).

## Dependencies

- Module 00 (auth/entitlements), Module 02 (traveller details for the PNR)
- Module 04 (ranked recommendations), Module 05 (pricing/margin)
- Module 06 (corporate approval gate, when applicable)
- Module 15 (mid/back office sync)

## Core concepts

- **Supplier Integration Layer**: Travelport TripServices (Galileo facade) and RateHawk sit
  behind an adapter interface — booking orchestration never calls a supplier SDK directly
  (dev guide §7).
- **Explicit booking state machine** — the single source of truth every other module reads:
  `Quoted → Reserved → Ticketed/Confirmed → Active → Completed | Cancelled | Refunded`.
- **Server is the pricing/policy authority** at every transition — a quote shown to the
  customer is re-validated before being reserved, and re-validated again before payment
  capture.

## Checklist

### Supplier search & adapters
- [ ] Galileo GDS adapter (Travelport TripServices Flights): flight availability + fare search
      — see [travelport-tripservices.md](../integrations/travelport-tripservices.md)
- [ ] RateHawk adapter: hotel availability + rate search
- [ ] Adapter interface abstracts supplier-specific request/response shapes into a common
      internal model (so a future Amadeus/Hotelbeds adapter is a drop-in)
- [ ] Per-adapter timeout, retry policy, and circuit breaker (a slow/down supplier degrades
      gracefully, doesn't hang the booking flow)
- [ ] Supplier result normalization (currency, fare rules, cancellation policy shape)

### Comparison & ranking
- [ ] Multi-supplier result merge before handing to Module 04 for ranking
- [ ] Stale-quote detection (supplier price/availability re-checked before reservation)

### Reservation & pricing
- [ ] Reserve inventory (PNR creation / hotel hold) against the chosen option
- [ ] Apply FlightOne margin via Module 05 before presenting final price
- [ ] Re-price at reservation time; surface a "price changed" flow if the supplier quote
      drifted from what the customer saw
- [ ] Idempotency key per booking attempt (no double-reservation on retry/double-click)

### Payment & approval
- [ ] Payment gateway integration (tokenized card capture, no raw PAN storage — Module 00)
- [ ] Corporate approval gate before payment capture, when the active profile is Corporate
      (Module 06) — policy/budget check blocks or requires sign-off
- [ ] Payment failure handling (release hold, notify customer, allow retry)

### Ticketing & documents
- [ ] Ticket issuance against the airline/GDS, idempotent (no double-issue on retry)
- [ ] Hotel voucher generation
- [ ] Issued documents pushed into Module 07 (Traveller Vault) automatically
- [ ] PNR/booking reference surfaced to the customer and stored against the profile

### State machine & sync
- [ ] Explicit state machine implementation with actor + timestamp on every transition
- [ ] Every transition writes an audit log entry
- [ ] Mid/back office connector notified on booking create/ticket/cancel/refund (Module 15)
- [ ] Booking record queryable by Module 09 (journey monitoring) and Module 14
      (refund/reissue)

## Business rules / invariants

- No booking reaches `Ticketed` without a server-side price/policy re-check immediately
  prior (dev guide §7 — "server is the real authority").
- Ticketing/voucher issuance must be idempotent under retry.
- Corporate bookings cannot bypass the approval/budget gate (Module 06) regardless of which
  client or AI path initiated the booking.
- Every state transition is audited and attributable to an actor (customer, AI, agent,
  system/worker).

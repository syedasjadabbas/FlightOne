# Module 04 — Intelligent Recommendation Engine

**PRD Module 4** · Prefix: `REC` · Phase: 1 (core ranking) → 3 (Predictive Recommendations)

## Objective (from PRD)

Evaluate supplier results against price, duration, layovers, airline quality, arrival
times, customer preferences, loyalty benefits, refundability, and supplier reliability —
and surface **typically three** curated options instead of an OTA-style results list.

## Dependencies

- Module 03 (raw supplier results to rank)
- Module 02 (customer preferences/loyalty to weight against)

## Core concepts

- This module is a **pure ranking/scoring service** over Module 03's normalized results —
  it does not call suppliers itself and does not touch pricing/margin logic (Module 05).
- "Curate to three" is a product constraint, not a hard cap enforced by truncation alone —
  the scoring function must actually produce a meaningfully differentiated top-N (e.g.
  cheapest, fastest, best-value), not three near-duplicates.

## Checklist

### Scoring factors
- [x] Price scoring (absolute + relative to cheapest available)
- [x] Journey duration scoring
- [x] Layover count/duration scoring (penalize long/short connections appropriately)
- [x] Airline quality signal — applied only when offer `airlineScore` is
      authoritative and differentiated in the pool (fail-closed / neutral when
      absent; never invent rankings). Live OTP/quality feeds remain external.
- [x] Arrival/departure time convenience (red-eye penalty, arrival-too-late penalty)
- [x] Customer preference weighting (preferred airlines, cabin, loyalty program alignment)
- [ ] Loyalty benefit awareness (miles-earning potential, status perks) — membership
      airline soft-boost only; no invented miles/perks
- [x] Refundability/fare-flexibility scoring (only when supplier marks refundable)
- [x] Supplier reliability signal (Booking.supplierCode fulfillment rate, min sample;
      omitted when history is thin — never a fabricated default %)

### Curation output
- [ ] Combine factor scores into a single ranked list with an explainable breakdown
      (feeds Module 01's "explain the recommendation" requirement)
- [ ] Select a differentiated top-3 (e.g. best overall, cheapest, fastest) rather than the
      raw top-3 by one axis
- [ ] "Show more options" escape hatch for customers who explicitly want the full list
      (doesn't violate the "typically three" default)

### Learning loop
- [ ] Capture accept/reject/ignore signal per recommendation shown
- [ ] Feed signal back into per-customer preference weighting (Module 02) over time

### Phase 3 extensions
- [x] Predictive recommendations (proactive suggestions based on history/season/price
      trends, not just reactive to a search)

## Business rules / invariants

- Ranking never re-derives or overrides price — it consumes the price Module 05 already
  computed; it must not do its own parallel pricing math.
- The "why this recommendation" explanation must be derivable from the actual scoring
  factors used, not a generic templated string — Module 01 will surface it verbatim to the
  customer.

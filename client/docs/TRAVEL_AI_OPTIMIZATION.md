# Travel AI — Optimization

How ranking works today, why it fails for complex trips, and the target itinerary optimizer.

---

## 1. Current ranking (actual code)

### 1.1 Pricing first

`lib/pricing/pricing.ts` — markup → `customerPrice`, floors, `marketIsEstimated` for live/GDS tags (blocks fake OTA-beat claims).

### 1.2 Per-offer score

`lib/recommendation/recommendation.ts` `scoreOne`:

| Signal | Weight (approx) |
|--------|-----------------|
| Price vs pool | 40 |
| Market edge | ≤25 (disabled for live) |
| Supplier reliability | 10 |
| Flight: duration | 15 |
| Flight: nonstop | +14 |
| Flight: airline quality | 10 |
| Hotel: rating/stars | 15+10 |

`curate(pool, n)` picks angles: **best_value → cheapest → fastest/top_rated**, backfill as recommended.

### 1.3 Multi-leg “curation”

`curateMultiLeg(legs, budget=4)` in `orchestrator.ts`:

- Spreads budget across legs ≈ `floor(budget / legCount)` picks **per hop**.  
- 4 flight legs → **1 offer each**.  
- No trip total, no joint utility, no hard stay check on combined schedule.  
- `diversifyByAirline` often no-ops when pick count < 2.

### 1.4 Intent filters (not optimization)

`applyIntentFilters` — drop on maxStops, refundable, airlinesOnly, layover, depart windows, checked bag when fields present. Soft policy may relax (except airlinesOnly).

**These are applied per offer after fetch** — GDS was not asked for nonstop/time windows.

### Summary

```text
Today ≈ sort/score(individual flight) + pick angles
Not ≈ solve(constraints) + optimize(complete itinerary)
```

---

## 2. What “optimize” must mean

For a complete journey candidate `Trip`:

```text
feasible = satisfies(all hard constraints)
score    = f(price, duration, stops, baggage, fare flexibility,
             preferences, ticket_construction_risk)
```

Example tradeoff surface:

| Candidate | Price | Stops | Duration | Bags | Fare |
|-----------|-------|-------|----------|------|------|
| A | 1600 | 4 | 42h | 1 | basic |
| B | 1680 | 3 | 29h | 2 | std |
| C | 1720 | 2 | 25h | 2 | flex |

Present as:

- **Cheapest** = A  
- **Best value** = B (default for “best fare” when soft)  
- **Best overall / fastest** = C  

User preference `optimization: cheapest|value|fastest|balanced` selects primary angle; always show 1–2 alternatives when available.

---

## 3. Hard constraint gate (before scoring)

Reject trip if any:

| Check | Example |
|-------|---------|
| Stay at London ≠ 2 nights (exact) | arrival local date + nights ≠ departure |
| Stay at SFO ≠ 15 days | same |
| Origin ∉ {LHE, ISB} | |
| Return origin ≠ MCO | |
| Cabin ≠ requested when hard | |
| Segment order / date monotonic | |
| Connection below MCT / impossible | |
| Duplicate / missing segment | |

Soft violations adjust score; never pass as “valid recommended” if hard fails.

---

## 4. Soft score sketch (target)

Deterministic, unit-testable, weights configurable:

```text
normalize(price)           → lower better
normalize(total_block_hours)
normalize(total_stops)
baggage_adequacy           → known vs required
fare_flexibility           → unknown = neutral
preferred_airline_hits
metro_airport_penalty      → optional soft
separate_ticket_risk       → penalty or separate rank axis
```

Output: `TripScore { total, components[], angleHints[] }`.

Do **not** ask Gemma to score hundreds of trips.

---

## 5. Itinerary generation before optimize

```text
Per-segment offer pools (after normalize + per-leg soft prune)
    │
    ▼
Cartesian / beam search with pruning
    │  prune by: date feasibility, running price bound,
    │            MAX_CANDIDATES
    ▼
Temporal closure (stay windows)
    │
    ▼
Hard filter
    │
    ▼
Score + diversify angles
    │
    ▼
Top K (3–5)
```

Beam / price-bound pruning is required so OR origins × metro airports does not explode.

---

## 6. Separate-ticket economics

When trips are OW concatenations:

```text
display_price = sum(leg.customerPrice)
construction  = "separate_tickets"
risk          = "high" | "medium"  // unprotected connections
```

If/when a single GDS multi-city price exists:

```text
construction  = "single_ticket"
compare_savings = separate_sum - single_price   // if both built
```

Never hide risk to win on price.

---

## 7. Relation to existing recommendation.ts

| Mode | Engine |
|------|--------|
| Single-leg / hotel / package | **KEEP** `curate` / `rank` |
| Multi-segment Trip | **NEW** `lib/travel/optimize` |
| UI cards | Map Trip → one composite card **or** ordered leg cards + **trip total banner** (product decision) |

Avoid deleting current curate until shadow mode proves Trip engine.

---

## 8. Metrics for optimization quality

Per session / shadow compare:

- Hard constraint satisfaction rate  
- Share of trips that beat baseline (sum of cheapest OW per leg)  
- Mean GDS calls vs recommendation quality (human or rubric)  
- Separate-ticket share labeled correctly  
- Revalidation price-delta distribution  

---

## 9. Gemma’s role after optimize

Gemma receives **only** top K trips with precomputed:

- totals, stays, stops, durations, construction, constraint checklist  

It chooses wording of Cheapest / Value / Overall — it does **not** recompute rank unless backend lists multiple allowed angles (backend already assigned primary).

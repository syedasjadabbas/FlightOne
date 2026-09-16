# Travel AI — Target Architecture

**Status:** Design target for incremental evolution (no big-bang rewrite).  
**Principle:** Evolve `flight-one` + `filght-one-server` in place. Reuse KEEP components from the [Architecture Audit](./TRAVEL_AI_ARCHITECTURE_AUDIT.md).

---

## 1. Target flow

```text
                         USER
                           │
                           ▼
              EXISTING FRONTEND (ChatLayout / guest chat)
                           │
                           ▼
                 EXISTING POST /api/chat   ← stable contract
                           │
                           ▼
                 ┌──────────────────────┐
                 │  AI TRAVEL AGENT     │
                 │  Gemma 4 / Ollama    │
                 │  NL → structured     │
                 │  intent + explanation│
                 └──────────┬───────────┘
                            │ TravelIntent (JSON)
                            ▼
                 ┌──────────────────────┐
                 │ TRAVEL ORCHESTRATOR  │  ← evolves today's orchestrator.ts
                 │ (deterministic)      │
                 └──────────┬───────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    Location Resolver  Search Strategy  Constraint Engine
    (places → IATA)    (dedupe/plan)    (hard / soft)
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                 EXISTING GAL ADAPTER
                 filght-one-server /suppliers/search
                 (+ future multi-leg / revalidate)
                            │
                            ▼
                     RAW GDS RESULTS
                            ▼
                       NORMALIZER  (improve travelport/normalize.js)
                            ▼
                  CANONICAL TRAVEL MODEL
                            ▼
                  ITINERARY GENERATOR
                            ▼
                  CONSTRAINT SOLVER
                            ▼
                  OPTIMIZATION ENGINE
                            ▼
                   TOP CANDIDATES
                            ▼
                   REVALIDATION (new)
                            ▼
                   GEMMA ANALYSIS (LLM #2 — grounded)
                            ▼
                   USER RESPONSE + OfferCards
```

---

## 2. Core principle (non-negotiable)

| Layer | Owns |
|-------|------|
| **Gemma** | NL understanding, planning *strategy suggestions*, explanation, clarify questions |
| **Backend** | Dates, stays, airport expansion rules, GDS I/O, normalize, combine, constraints, optimize, revalidate |
| **GAL/GDS** | Authoritative flights/hotels/fares/availability |

Gemma **must never invent** flight numbers, prices, availability, schedules, baggage, fare rules, connection times, or ticketing conditions.

---

## 3. What already maps (do not duplicate)

| Target box | Existing module | Action |
|------------|-----------------|--------|
| Frontend | `ChatLayout`, `useGuestChat` | KEEP |
| Travel API | `app/api/chat/route.ts` | KEEP; add tracing headers later |
| Gemma extract | `extractTravelPlan.ts` | IMPROVE → emit richer `TravelIntent` |
| Gemma reply | `prompt.ts` | IMPROVE budget + trip-level candidates |
| Orchestrator shell | `orchestrator.ts` | REFACTOR into thin pipeline + planning packages |
| GDS adapter | `travelport/*`, `supplierSearch.ts` | KEEP + wrap behind interface |
| Pricing | `lib/pricing/pricing.ts` | KEEP |
| Per-offer rank | `recommendation.ts` | KEEP for single-leg; ADD itinerary optimizer |
| Location | `places.ts` | REPLACE data source; KEEP API shape initially |
| Booking | `bookings.service.js`, `close.ts` | KEEP isolated |
| Cache primitive | `swr-cache.js` | REUSE for search TTL |

---

## 4. New / grown modules (proposed packages)

Prefer colocating under existing trees:

```text
flight-one/lib/travel/           # NEW planning domain (TypeScript)
  canonical/                     # Airport, FlightOffer, Itinerary, Trip, …
  intent/                        # TravelIntent schema + Zod
  session/                       # TravelSession (in-memory → later DB)
  location/                      # resolver wrapping places + expansion
  search-strategy/               # plan GDS calls, dedupe, budgets
  itinerary/                     # combine legs → Trip candidates
  constraints/                   # hard/soft engine
  optimize/                      # multi-objective rank
  revalidate/                    # client to new server endpoint
  metrics/                       # counters per session
  shadow/                        # compare old vs new planner

filght-one-server/modules/suppliers/travelport/
  revalidate.js                  # offer-build / price confirm (NEW)
  # later: multi-leg search.js refactor
```

Do **not** create a new database, queue, or auth system in the planning phase.

---

## 5. Canonical travel model (minimum)

Introduce types that the rest of the app consumes after normalize:

| Type | Responsibility |
|------|----------------|
| `Airport` | IATA, city, metro group |
| `Airline` | IATA/ICAO, name |
| `FlightSegment` | One takeoff–landing |
| `FlightLeg` | Ordered segments (one OW product) |
| `Fare` / `FareBrand` | Price, brand, cabin |
| `Baggage` | Piece/weight if known; else `unknown` |
| `FareRule` | Refund/change when known; else `unknown` |
| `Connection` | MCT, airport change, overnight |
| `FlightOffer` | Bookable OW or priced journey unit from GDS |
| `Itinerary` / `Trip` | Combined journey + total + ticketConstruction |
| `TravelConstraint` | Hard/soft with predicate + human label |

**Rule:** UI, optimizer, and Gemma context read canonical types — not GAL JSON.

Bridge: improve `dtoToFlightOffer` → map into canonical, then to existing `Offer`/`OfferCard` for UI compatibility.

---

## 6. Travel intent model

Evolve beyond `TravelPlan` (keep wire compatibility during migration):

```json
{
  "trip_type": "multi_city",
  "passengers": { "adults": 1, "children": 0, "infants": 0 },
  "cabin": "economy",
  "segments": [
    {
      "origin": ["LHE", "ISB"],
      "destination": ["LON"],
      "stay": { "nights": 2, "exact": true }
    },
    {
      "origin": ["LON"],
      "destination": ["SFO"],
      "stay": { "days": 15, "exact": true }
    },
    { "origin": ["SFO"], "destination": ["MCO"] },
    { "origin": ["MCO"], "destination": ["LHE", "ISB"] }
  ],
  "constraints": { "hard": [], "soft": [] },
  "preferences": { "optimization": "cheapest" }
}
```

**Metro expansion:** `LON` → `{ LHR, LGW, STN, LTN, LCY }` only when city/metro requested; explicit “Heathrow” → `LHR` only.

Missing fields → clarify (existing action), not silent guess when hard constraints incomplete (e.g. no departure window at all).

---

## 7. Hard vs soft constraints

| Hard (must satisfy) | Soft (optimize) |
|---------------------|-----------------|
| Exact stay nights/days | Cheapest / fewest stops |
| Allowed origin/dest airport sets | Preferred airline |
| Cabin when user insists | Baggage quantity |
| Max stops when `airlinesOnly`/`nonstopOnly` treated as hard | Shorter duration |
| Return city MCO | Flexible fare |

Optimizer **must not** violate hard constraints for a lower price.

---

## 8. Search strategy (example)

Intent → strategy graph (not one GDS call):

```text
A: LHE→LON*   B: ISB→LON*
C: LON*→SFO
D: SFO→MCO
E: MCO→LHE    F: MCO→ISB
```

Then combinatorial constructions (dates from stay calculator):

```text
LHE→LON→SFO→MCO→LHE
LHE→LON→SFO→MCO→ISB
ISB→LON→SFO→MCO→LHE
ISB→LON→SFO→MCO→ISB
```

**Budgets (config):**

```text
MAX_SEARCH_ROUNDS
MAX_GDS_REQUESTS_PER_SESSION
MAX_CANDIDATES
SEARCH_CACHE_TTL_SECONDS
```

Independent searches **parallel**; dependent only when date of leg *n+1* requires arrival of leg *n* (or use flexible date bands).

Prefer **one multi-leg GDS search** when Travelport API + adapter support it (Phase: GDS IMPROVE) to get through-fares; until then, label constructions as **separate tickets**.

---

## 9. Agent loop (conceptual)

```text
USER → PARSE INTENT → MISSING INFO?
  → CREATE SEARCH PLAN → EXECUTE GDS (budgeted)
  → NORMALIZE → GENERATE TRIPS → CONSTRAINTS → OPTIMIZE
  → “Worth another search round?” (deterministic heuristics + optional Gemma advise)
  → YES (under limits) | NO → REVALIDATE shortlist
  → GEMMA EXPLAIN → RESPOND
```

Hard stop: max rounds / max GDS / max wall clock.

Full detail: [TRAVEL_AI_AGENT_FLOW.md](./TRAVEL_AI_AGENT_FLOW.md).

---

## 10. Tool surface for Gemma (future)

Do **not** expose raw GAL. High-level tools only:

| Tool | Level |
|------|-------|
| `resolve_location` | READ |
| `search_flights` / `search_multicity` | READ |
| `get_fare_details` / `get_baggage` / `get_fare_rules` | READ |
| `get_trip_state` | READ |
| `revalidate_offer` | VALIDATE |
| `createPNR` / `issueTicket` / … | TRANSACTIONAL — user confirm |

**Near term:** keep dual-LLM without tools; orchestrator owns the loop. Tools are optional Phase 10+ if agentic extract needs mid-turn retrieval.

---

## 11. Revalidation

```text
Search → shortlist → revalidate → confirm price/availability/rules → present
```

Price change must be shown (old vs new). Never silently use stale search price as “current.”

Until Travelport offer-build exists: mark UI copy as “indicative search price; reservations will reconfirm” (already close to product language) — but track as explicit gap.

---

## 12. Follow-up intelligence

`TravelSession` holds:

- Last intent + constraints  
- Last shortlist of trips  
- Search keys already executed  
- Optimization preference  

“Make it cheaper.” → mutate soft objective / widen soft constraints → reuse session; ask before relaxing hard constraints.

---

## 13. Shadow mode

```text
User request
  → Existing orchestrator → Result A (shown)
  → New planner (async/flag) → Result B (logged)
Compare: price, count, GDS calls, latency, constraint satisfaction
```

Gate with `TRAVEL_AI_SHADOW=true`. No user-visible switch until scores win.

---

## 14. Explicit non-goals (this refactor)

- New Redis/Kafka unless proven needed  
- Replacing Prisma booking state machine  
- Live PNR from chat before GDS book adapters exist  
- Passing raw GAL XML/JSON to Gemma  
- Rewriting the Next.js App Router or Express app shell  

---

## 15. Success criteria (acceptance)

The exemplar Pakistan multi-city open-jaw request yields:

1. Structured intent with OR origins + London 2n + SFO 15d + MCO return.  
2. A search plan with parallel/deduped GDS calls under budget.  
3. Canonical offers → trip candidates that pass hard stays.  
4. Ranked complete itineraries (cheapest / value / fastest as appropriate).  
5. Separate-ticket risk labeled when applicable.  
6. Gemma explains only validated numbers.  
7. Existing simple OW/RT/hotel chat paths remain green in tests.

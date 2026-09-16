# Travel AI — GDS Flow

Authoritative map of how FlightOne reaches Travelport (GAL) today, gaps for planning, and the target path. Complements [integrations/travelport-tripservices.md](./integrations/travelport-tripservices.md).

---

## 1. Current GDS flow

```text
flight-one
  lib/inventory/supplierSearch.ts
    searchSuppliers(body)
      TRAVELPORT_LIVE_SEARCH !== "false"
      INTERNAL_API_KEY required
      POST {FLIGHTONE_API_URL}/suppliers/search
      cache: "no-store"
      timeout ~50s flight / ~55s hotel
        │
        ▼
filght-one-server
  middlewares/auth.js  requireAuthOrInternalKey
  modules/suppliers/suppliers.routes.js  POST /search
  suppliers.validators.js  Zod Flight|Hotel query
  suppliers.service.js
        │
        ├─ FLIGHT → galileo.adapter.js
        │     travelport/auth.js     (token cache)
        │     travelport/http.js     (Bearer + AccessGroup + PCC)
        │     travelport/search.js   CatalogProductOfferings Air
        │     travelport/normalize.js
        │
        └─ HOTEL → ratehawk.adapter.js → stays* (Travelport Stays v12)
        │
        ▼
  { offers: [...] }  normalized DTOs only
        │
        ▼
  dtoToFlightOffer / dtoToHotelOffer
  (client fabricates: baggageKg 20, market×1.08, scores)
```

### Preferred airline path

```text
searchFlightsPreferredThenOpen
  Promise.all([
    search with preferredCarriers → CarrierPreference Permitted,
    open search
  ])
  merge by id, rank preferred first
```

Soft-empty on preferred failure: `search.js` catch returns `[]` for **any** error when carriers set (auth/timeout blurred with no inventory).

---

## 2. What is actually sent (air)

From `travelport/search.js`:

- `SearchCriteriaFlight[]`: outbound; + return if `returnDate` (max **2**).  
- ADT passengers only.  
- Cabin preference for non-economy.  
- CarrierPreference ≤6 codes.  
- Currency / max offers / upsells=2.  
- **Not sent:** multi-city N>2, child/infant, flexible dates, max stops, time windows, exclude carriers.

Multi-city in Ava = **N separate one-way POSTs** from `retrieveFromPlan` (`Promise.all`).

---

## 3. What is returned (air normalize)

Per offer (approx): price minor, currency, segments (carrier, flight #, times, equipment), stops, duration, layoverMinutesAfter, cabin mapping, brandRef, transactionId.

**Known defects (audit):**

| Issue | Location |
|-------|----------|
| Round-trip offerings flattened; client origin/dest stamped from query | `normalize.js` |
| Layover from naive local `Date.parse` (TZ wrong) | `normalize.js` |
| Truncate unsorted at maxOffers | `normalize.js` |
| `refundable: false` hardcoded | `normalize.js` |
| No baggage allowance | server |
| `e2eTrackingId` dropped on success | `search.js` |
| decimalPlace ignored (JPY risk) | `toMinor` |

---

## 4. Booking / revalidation (current)

```text
/api/v1/bookings  → Prisma state machine only
revalidatePrice   → margin recomputation on stored netMinor
                    NO Travelport offer-build
```

Chat **never** calls bookings for live search results. Close path = ops handoff.

---

## 5. Target GDS flow

```text
Gemma / Strategy
    │
    ▼
Travel Service (flight-one/lib/travel or server planning module)
    │  dedupe key, cache, concurrency limits
    ▼
GDS Abstraction (existing adapter.js + extensions)
    │
    ├─ searchOneWay / searchRoundTrip / searchMultiCity
    ├─ revalidateOffer (NEW)
    ├─ getFareRules / baggage (NEW, when catalog exposes)
    └─ (later) book / ticket — TRANSACTIONAL
    ▼
GAL / Travelport
    ▼
Normalizer → Canonical FlightOffer[]
    ▼
Planner (itinerary / constraints / optimize)
```

**Not:**

```text
Gemma → GAL API
```

---

## 6. Search efficiency controls

| Control | Today | Target |
|---------|-------|--------|
| Deduplication | None | Hash of normalized query |
| Caching | None | TTL via `swr-cache` or in-process LRU |
| Parallel independent | Legs yes; hotel comps no | All independent yes |
| Pruning | Cap 12 unsorted | Sort then slice; early stop when soft obj met |
| Prefer+open | Always 2 | Skip open if preferred meets hard+budget |
| Multi-leg API | N OW | Prefer 1 multi-city when adapter ready |

Config:

```text
MAX_GDS_REQUESTS_PER_SESSION
SEARCH_CACHE_TTL_SECONDS
TRAVELPORT_MAX_OFFERS
```

---

## 7. Separate tickets vs single ticket

| Construction | When | UX |
|--------------|------|----|
| **Single ticket** | GDS returns one priced multi-city / through itinerary | Present as protected connection where GDS says so |
| **Separate tickets** | Combined from independent OW searches | Always show savings **and** risk (missed connection = unprotected) |

Today every Ava multi-city path is separate tickets — **must be labeled** once trip totals exist.

---

## 8. Revalidation target flow

```text
Shortlisted CatalogProductOffering refs / offer ids
    │
    ▼
POST /suppliers/revalidate  (new) → Travelport offer build
    │
    ▼
Canonical fare snapshot { price, available, rulesSummary }
    │
    ▼
If priceDelta > threshold → expose Old/New in Gemma context + UI
```

Until endpoint exists: planner marks `validationStatus: "search_only"`.

---

## 9. KEEP / IMPROVE / REFACTOR (GDS)

| Item | Action |
|------|--------|
| Adapter interface, Zod boundary, http/auth | KEEP |
| Stays request builder + FX honesty | KEEP |
| Booking state machine seam | KEEP |
| Soft-empty discrimination | IMPROVE |
| Token single-flight + search cache | IMPROVE |
| Sort-before-truncate; preserve tracking id | IMPROVE |
| Multi-leg SearchCriteria + direction-aware model | REFACTOR |
| Offer-build revalidate + fare/baggage model | REFACTOR (additive) |
| Client fabricated baggage/market | IMPROVE → stop |

---

## 10. Authority rule

Search and revalidate responses from GAL are the only sources of schedule/price/availability facts for recommendations. Seed inventory remains a **degraded fallback** and must never be presented as live GDS without labeling (align with prompt “seed” softening — prefer honest gaps).

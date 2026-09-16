# Web Meta-Search Fallback — Implementation Plan

**Status:** Draft · **Audience:** FlightOne engineering  
**Companion:** [kayak-ask-ai-multicity-live-study.md](./stakeholders/kayak-ask-ai-multicity-live-study.md)

---

## 1. Goal & analogy

**Problem:** On multi-city trips, Travelport/GDS often returns inventory for some legs but not others (e.g. LHE→LON and MCO→LHE live, but LHR→SFO and SFO→MCO empty on our PCC). Today `retrieveFromPlan` correctly leaves empty leg buckets instead of seed JSON — but the results rail shows blank leg panels and Ava cannot describe a complete journey.

**Goal:** When GDS has zero (or, in phase 2, insufficient) results for a leg, fill that leg from **Google Flights via SerpAPI** — the same source Kayak/ChatGPT use for meta-search — and show it **clearly labeled as indicative, not FlightOne bookable inventory**.

| Actor | Role |
|---|---|
| **GDS / Travelport** | Bookable source of truth. Only these offers may enter checkout or be priced as ours. |
| **Google Flights (Serp)** | Market discovery — route exists, airline mix, ballpark price. Kayak-style “see what's out there.” |
| **Ava (LLM)** | Narrates partial coverage honestly; never implies we can ticket web-meta fares. |

**Contract (already in `lib/comps/index.ts`):** `bookable = GDS only`; Google/OTA = indicative narrative.

**Reference query:** LHE/ISB → London (2n) → SFO (15d) → Orlando → PK return. GDS: PK→London ✓, MCO→PK ✓; LHR→SFO ✗, SFO→MCO ✗.

---

## 2. Trigger conditions

Web-meta fallback runs **per flight leg** when **all** of the following hold:

| # | Condition | Rationale |
|---|---|---|
| T1 | `flightLegCount > 1` (multi-city / open-jaw) | Single-route comps already use Serp in `flightComps.ts`; do not duplicate. |
| T2 | GDS leg returned `live.length === 0` after `searchFlightsWithRouting` | Only fill gaps; never replace live inventory. |
| T3 | `isSerpConfigured()` (`SERPAPI_API_KEY` or `SERP_API_KEY`) | Soft-fail to current empty-leg behavior. |
| T4 | Leg has valid `origin`, `destination`, `departureDate` (IATA + ISO date) | Serp rejects bad inputs; skip rather than retry junk. |
| T5 | Feature flag `WEB_META_LEG_FALLBACK=1` (env, default off in prod until MVP verified) | Safe rollout / kill switch. |

**Do not trigger when:**

- GDS returned ≥1 live offer for the leg (even if user wanted more variety).
- Leg is a hotel search.
- `returnDate` on leg is set **and** GDS returned paired RT — Serp one-way per leg is correct for multi-city assembly.
- Entire trip is single-origin RT (use existing `resolveFlightComps` path).

**Partial vs empty (phase 2):** MVP triggers only on **zero** GDS offers. Phase 2 may also trigger when GDS count &lt; threshold (e.g. &lt;3) to enrich thin legs — gated separately.

---

## 3. Data flow

```
User message
    │
    ▼
extractTravelPlan / openJawRecovery
    │
    ▼
retrieveFromPlan ──► per leg: searchFlightsWithRouting (GDS)
    │                      │
    │                      ├─ hits ──► legBuckets[i] = live offers, legLive[i]=true
    │                      │
    │                      └─ miss + multi-leg ──► webLegFallback (Serp)
    │                                    │
    │                                    └─► FlightOffer[] tagged indicative
    ▼
RetrieveResult { legs[][], legLive[], legSource[]? }
    │
    ▼
executeMultiCitySearch
    ├─ buildLegPanels (per-leg rail blocks)
    ├─ runItineraryPipeline (GDS-only legs for MVP — see §7)
    └─ buildLegGdsDiagnostics → Ava reply / partialReply
    │
    ▼
SearchResultsPanel → ResultsRail UI
```

**Latency:** Serp calls for empty legs run in parallel (`Promise.all`), 20s timeout each, max 4 concurrent per search turn.

---

## 4. Module boundaries

| Module | Responsibility | Must not |
|---|---|---|
| **`lib/comps/serpFlights.ts`** | Raw SerpAPI I/O, `SerpFlightOption`, retries, currency/locale. | Know about multi-city plans or UI. |
| **`lib/comps/webLegFallback.ts`** *(new)* | Map `SerpFlightOption` → `FlightOffer`; stable synthetic IDs; tag offers; optional airline post-filter from plan filters. | Call GDS; apply FlightOne markup semantics. |
| **`lib/ask-ai/retrieve.ts`** | Orchestrate GDS then conditional web fallback; extend `RetrieveResult`. | Render UI; run itinerary scoring. |
| **`lib/ask-ai/multiCitySearch.ts`** | Build `LegSearchPanel[]`, diagnostics, partial vs empty replies. | Call Serp directly. |
| **`lib/ask-ai/offerCard.ts`** | Badge mapping from offer tags → `OfferCard.badges`. | Decide when to fetch Serp. |
| **`app/components/ask-ai/ResultsRail.tsx`** | Leg panel headers, source labels, disable book CTA for web-meta. | Fetch or transform inventory. |

**Dependency rule:** `webLegFallback` depends on `serpFlights` + `inventory/types`; `retrieve` depends on `webLegFallback`; UI depends on typed panel fields only.

**Export surface:** Add `resolveWebLegFallback` and `serpOptionToFlightOffer` from `lib/comps/index.ts` alongside existing comps exports.

---

## 5. Offer tagging

Every web-meta `FlightOffer` carries:

```ts
tags: ["indicative", "web-meta", "not-bookable"]
supplier: "google-flights"   // never "travelport" / "gds"
```

| Tag | Meaning |
|---|---|
| `indicative` | Price is market reference, not a net fare we pay. |
| `web-meta` | Sourced from Google Flights aggregation, not our PCC. |
| `not-bookable` | Excluded from checkout, WhatsApp handoff, and “Live fare” badges. |

**Explicitly omit:** `live`, `travelport`, `gds`.

**Pricing:** `netFare` = Serp `priceMajor` in minor units (for display sort only). Extend `priceOffer` to treat `indicative` like estimated market — **no markup, no savings-vs-market claims, no negotiation room.** Customer-facing price label = “from Google Flights” not FlightOne quote.

**IDs:** Deterministic hash, e.g. `web-meta:${origin}-${dest}-${date}-${carrierHint}-${stops}-${price}` — avoids collisions across legs.

**Extend `RetrieveResult`:**

```ts
legSource?: ("gds" | "web-meta" | "seed")[];
webMetaLegCount?: number;
```

---

## 6. UI labeling

### Leg panels (`ResultsRail`)

Extend `LegSearchPanel`:

```ts
source?: "gds" | "web-meta" | "mixed";
indicative?: boolean;
```

| Panel state | Header subline | Offer rows |
|---|---|---|
| GDS live | `12 live GDS fares` | Existing “Live fare” badge |
| Web-meta fill | `8 Google Flights estimates · not bookable with FlightOne` | Amber “Web estimate” badge |
| Still empty | `No GDS inventory · Google Flights also returned nothing` | Empty state copy |

Stage labels (`Outbound to stopover`, etc.) unchanged — source label sits below route mono line.

### Trip cards / main rail

- **MVP:** Web-meta offers appear **only in leg panels**, not in top-level combined itinerary cards or `itineraries[]` (GDS assembly stays honest).
- **Phase 2:** Optional “Estimated full trip” card with strikethrough total and disclaimer banner.

### Offer row (`OfferRowCompact`)

- If `badges` includes `Web estimate`: muted price styling, no “Best/Cheapest” angle badges.
- Hide or replace “View offer” with “See on Google Flights” (external link using Serp deep link if available; else no link — price reference only).

### Ava copy

Update `buildLegGdsDiagnostics` and `lib/ask-ai/prompt.ts` context:

> “Travelport has live fares for LHE→London and Orlando→Lahore. **London→San Francisco and San Francisco→Orlando aren't in our GDS** — I've added **Google Flights estimates** (indicative, not bookable here) so you can see typical options. I can help book the legs we have live, or adjust dates/airports.”

**Never say:** “I found flights for your full trip” when any leg is web-meta only.

---

## 7. Phased rollout

### Phase 1 — MVP: fill empty legs (target: 1 sprint)

1. `webLegFallback.ts` + unit tests.
2. Hook in `retrieveFromPlan` after empty multi-leg branch (lines 145–148).
3. `LegSearchPanel.source` + ResultsRail labeling.
4. `offerCard` + `pricing` indicative handling.
5. Ava diagnostics copy.
6. Flag `WEB_META_LEG_FALLBACK=1` in dev/staging.

**Acceptance:** Reference query shows 4 leg panels — 2 live GDS, 2 web-meta with badges; no false “bookable” CTAs; itinerary combiner does not stitch web-meta into pseudo-tickets.

### Phase 2 — Enriched meta-search

- Trigger on thin GDS legs (&lt;3 offers), not only zero.
- “Estimated journey total” card (sum of GDS net + Serp indicative, labeled).
- Optional Serp `deep_search` only for empty legs (cost control).
- Metro airport expansion before Serp (reuse `altAirports` — try IAD/DCA when DCA empty).
- Cache Serp responses per `(origin, dest, date, currency)` for 15–30 min (Redis or in-memory LRU) to cut rate limits.

### Phase 3 — Full web-only itinerary (optional)

When **all** legs are web-meta (zero GDS anywhere): show Kayak-style “market view” with prominent disclaimer and CTA to human agent / WhatsApp — still no fake booking.

---

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Serp rate limits / cost** | Empty fallback, slow turns | Parallel cap, cache, flag kill switch, skip deep_search in MVP |
| **Price staleness** | User sees $800, GDS/agent quotes $1,200 | Always label indicative; show “as of search time”; no checkout |
| **No booking path** | Frustration if UX looks like inventory | `not-bookable` tag enforced in UI + API; disable handoff for web-meta IDs |
| **False completeness** | Ava implies full ticket | Keep web-meta out of `runItineraryPipeline` in MVP; diagnostics name missing GDS legs |
| **Serp empty too** | Still blank leg | Fall through to current empty message; suggest alt airports/dates |
| **Legal/brand** | Appearing to sell OTA fares | “Google Flights estimate” wording; supplier field not FlightOne |
| **Filter pills break** | Sidebar filters hide web-meta | `applyFilters` passes through `not-bookable` or dedicated “Include web estimates” pill (off by default) |

---

## 9. Files to create / modify

### Create

| File | Purpose |
|---|---|
| `lib/comps/webLegFallback.ts` | Serp → `FlightOffer` mapping, `resolveWebLegFallback()` |
| `lib/comps/webLegFallback.test.ts` | Mapping, tags, ID stability, empty Serp |
| `lib/ask-ai/retrieve.webMeta.test.ts` | Integration: empty leg → web fill; GDS hit → no Serp call |

### Modify

| File | Change |
|---|---|
| `lib/comps/index.ts` | Export `resolveWebLegFallback`, document contract |
| `lib/ask-ai/retrieve.ts` | Call fallback; extend `RetrieveResult` |
| `lib/ask-ai/types.ts` | `LegSearchPanel.source`, `indicative` |
| `lib/ask-ai/multiCitySearch.ts` | Pass `legSource` into `buildLegPanels`; set `live`/`source` correctly |
| `lib/ask-ai/multiCity.ts` | Extend `buildLegGdsDiagnostics` for web-meta legs |
| `lib/ask-ai/offerCard.ts` | Badges: “Web estimate”, suppress “Live fare” |
| `lib/ask-ai/prompt.ts` | Search context mentions indicative legs |
| `lib/pricing/pricing.ts` | Pass-through pricing for `indicative` tag |
| `app/components/ask-ai/ResultsRail.tsx` | Source-aware leg headers |
| `app/components/ask-ai/OfferRowCompact.tsx` | Visual treatment + CTA guard |
| `app/components/FlightOfferDetailModal.tsx` | Disclaimer banner for web-meta |
| `.env.example` | `WEB_META_LEG_FALLBACK`, document Serp keys |

### Do not modify (MVP)

- `lib/travel-planner/orchestrator.ts` — no web-meta in itinerary combiner until phase 2.
- `lib/comps/flightComps.ts` — single-route path stays separate.

---

## 10. Test strategy

### Unit

- **`webLegFallback.test.ts`:** Serp option → offer fields; tags present; no `live`; price minor units; invalid IATA/date → `[]`.
- **`pricing.test.ts` (extend):** `indicative` offer → zero markup, `hasMarketEdge=false`.
- **`offerCard.test.ts` (new or extend):** badges include “Web estimate”, exclude “Live fare”.

### Integration

- **`retrieve.webMeta.test.ts`:** Mock GDS empty + mock Serp; assert `legSource[i]==='web-meta'`, `legLive[i]===false`. Mock GDS hit → assert Serp not called (spy on `searchGoogleFlights`).
- **`multiCitySearch.test.ts` (extend):** Partial GDS + web-meta → `legPanels` length, `partialReply` mentions indicative.

### Manual / staging

1. Enable flag + Serp key; run reference LHE→LON→SFO→MCO query.
2. Verify leg panel mix: 2 GDS / 2 web-meta labels.
3. Confirm top itinerary rail does not show false combined tickets (MVP).
4. Click web-meta row — no book flow.
5. Disable flag — behavior reverts to empty legs.

**Observability:** Log `[web-meta] leg ${route}: ${n} options (${ms}ms)`; counters for fill/empty/latency.

*Next step:* Implement phase 1 behind `WEB_META_LEG_FALLBACK=1`; validate with stakeholder query #1 from the Kayak study before enabling in production.

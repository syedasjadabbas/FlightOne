# Travel AI — Architecture Audit

**Status:** Phase 1–2 deliverable (read-only audit). No code changes implied.  
**Audited:** 2026-08-11  
**Repos:** `flight-one` (Next.js consultant) · `filght-one-server` (Express / Travelport / Prisma)

This document describes the **system as it exists in the repository**, with KEEP / IMPROVE / REFACTOR / REPLACE classifications. Invented architecture is out of scope.

Related docs:

- [TRAVEL_AI_TARGET_ARCHITECTURE.md](./TRAVEL_AI_TARGET_ARCHITECTURE.md)
- [TRAVEL_AI_AGENT_FLOW.md](./TRAVEL_AI_AGENT_FLOW.md)
- [TRAVEL_AI_GDS_FLOW.md](./TRAVEL_AI_GDS_FLOW.md)
- [TRAVEL_AI_OPTIMIZATION.md](./TRAVEL_AI_OPTIMIZATION.md)
- [TRAVEL_AI_MIGRATION_PLAN.md](./TRAVEL_AI_MIGRATION_PLAN.md)

---

## 1. Current Architecture (actual modules)

```text
Guest (browser)
  │
  ▼
app/components/ChatLayout.tsx
app/hooks/useGuestChat.ts          ← stream: true
  │
  ▼
POST /api/chat                     app/api/chat/route.ts
  │  body: { message, history?, location?, stream? }
  │  max message 2000 chars; history ≤20 turns
  ▼
lib/consultant/orchestrator.ts     runConsultant / runConsultantStream
  │
  ├─① Greeting short-circuit       serviceMessages.ts (isGreetingOnly)
  ├─② Capability gap               detectCapabilityGap → canned reply
  ├─③ Close intent                 close.ts → WhatsApp / collect names
  ├─④ LLM #1: extractTravelPlan    extractTravelPlan.ts + travelPlan.ts
  │     Ollama / Gemma via         lib/llm/ollama.ts + lib/llm/index.ts
  ├─⑤ Plan repair                  coercePlan · guardPlanPassengers ·
  │                                 splitComplexReturnPlan
  ├─⑥ Retrieve inventory
  │     ├─ search: retrieveFromPlan → Promise.all per SearchLeg
  │     │     lib/inventory/supplierSearch.ts
  │     │     lib/inventory/searchFlightsPreferred.ts
  │     │     lib/inventory/liveFlights.ts / liveHotels.ts
  │     ├─ package: retrieveSeedPackages (seed JSON)
  │     └─ heuristic: extractIntent + retrieveOffers
  ├─⑦ Soft/hard filters            applyIntentFilters · softFilterOffers
  ├─⑧ Pricing                      lib/pricing/pricing.ts
  ├─⑨ Rank / curate                lib/recommendation/recommendation.ts
  │                                 curateMultiLeg · diversifyByAirline
  ├─⑩ Optional comps (1-leg only)  lib/comps/flightComps.ts · hotelComps.ts
  └─⑪ LLM #2: sales reply          prompt.ts + buildOfferContext
        → ConsultantResponse { reply, offers[], … }

Authenticated path (separate product):
  useAuthedChat → filght-one-server /conversations
  → conversations.service.js generateAssistantReply  ← STUB (no Ava)
```

### GAL / GDS path (authoritative search today)

```text
supplierSearch.ts  POST ${API}/suppliers/search
  Header: X-Internal-Api-Key
        │
        ▼
filght-one-server
  app.js → /api/v1/suppliers
  suppliers.routes.js  POST /search
  requireAuthOrInternalKey
  suppliers.service.js
        │
        ├─ product FLIGHT → travelport/galileo.adapter.js
        │     auth.js → http.js → search.js → normalize.js
        └─ product HOTEL  → travelport/ratehawk.adapter.js (live = Stays)
              staysRequest.js → staysSearch.js → stays.js
        │
        ▼
  { offers: SupplierOffer[] }   ← normalized only; raw GDS discarded
        │
        ▼
  dtoToFlightOffer / dtoToHotelOffer   (flight-one)
  → priceOffer → OfferCard UI
```

**There is no Gemma → GAL path.** Gemma never sees raw Travelport JSON. It sees:

1. **LLM #1:** conversation text → structured `TravelPlan` JSON.  
2. **LLM #2:** curated `AVAILABLE OFFERS` summaries (few lines per card) → short sales copy.

---

## 2. Component inventory & disposition

| Component | Path | Disposition | Notes |
|-----------|------|-------------|-------|
| Guest chat API | `app/api/chat/route.ts` | **KEEP** | Stable public contract; add rate limits later (IMPROVE). |
| Orchestrator | `lib/consultant/orchestrator.ts` (~1.8k) | **REFACTOR** | Split planning / retrieve / curate / reply; don’t rewrite behavior in place. |
| Dual-LLM extract + reply | `extractTravelPlan.ts`, `prompt.ts` | **KEEP** core honesty | Evolve extract → richer intent; reply stays grounded. |
| TravelPlan schema | `travelPlan.ts` | **IMPROVE** → intent model | Caps, no OR-origins, weak date/stay typing. |
| Intent filters | `types.ts` `IntentFilters` | **IMPROVE** | Hard vs soft incomplete; many filters never reach GDS. |
| Places gazetteer | `lib/inventory/places.ts` | **REPLACE** eventually | 67-entry table; Orlando/MCO gaps. |
| Supplier search client | `supplierSearch.ts` | **KEEP** | Thin DTO mapper; stop fabricating baggage/market. |
| Preferred+open merge | `searchFlightsPreferred.ts` | **KEEP** / later server-side | Correct policy; doubles GDS load. |
| Pricing | `lib/pricing/pricing.ts` | **KEEP** | Markup + live `marketIsEstimated` honesty. |
| Recommendation | `lib/recommendation/recommendation.ts` | **IMPROVE** | Per-offer, not itinerary-level. |
| Comps | `lib/comps/*` | **KEEP** | Indicative; single-leg only today. |
| Close / WhatsApp | `close.ts`, `whatsappPolicy.ts` | **KEEP** | Chat never tickets. |
| Capability gaps | `serviceMessages.ts` | **IMPROVE** | Some false positives (e.g. “save … this”). |
| Feedback | `app/api/feedback`, `lib/feedback/*` | **KEEP** | JSONL pilot. |
| Travelport search | `filght-one-server/.../travelport/*` | **KEEP** adapter skeleton | Multi-leg, RT pairing, revalidate missing. |
| Booking state machine | `bookings.service.js` | **KEEP** isolated | No live PNR; do not couple to planner yet. |
| Dashboard SWR cache | `lib/swr-cache.js` | **KEEP** unused by GDS | Reuse for search TTL. |
| Authed conversation stub | `conversations.service.js` | **IMPROVE** | Login currently loses Ava. |
| Redis / BullMQ / TravelSession | — | **N/A** | Do not invent unless migration needs them. |

---

## 3. Current travel flow (happy path)

1. User sends natural language to `/api/chat`.  
2. Rules fire (greeting / gap / close) without inventory when matched.  
3. **Extract:** Gemma emits `TravelPlan` (`search` | `package` | `clarify` | `close` | `off_topic`).  
4. Deterministic repairs fix passengers, split some complex returns, append home leg when regexes match.  
5. For each `SearchLeg`, Next.js calls server `POST /suppliers/search` (parallel `Promise.all`). Named airline → **two** searches (permitted + open).  
6. Offers priced and filtered; multi-leg → `curateMultiLeg` (**~1 pick per leg** when 4 legs / budget 4).  
7. Gemma writes 2–3 sentences from curated summaries.  
8. UI shows offer cards; “Book” resubmits chat text → close / reservations handoff. **No GDS book.**

Failure / degrade:

- Extract fails after repair → heuristic **or** `degradedComplexReply` if `looksComplexForHeuristic`.  
- Supplier error → seed inventory may substitute for that leg (can mask outages).  
- Filters emptying pool → soft-relax (except `airlinesOnly`).

---

## 4. Gemma / Ollama integration

| Concern | Reality |
|---------|---------|
| Provider | `LLM_PROVIDER=auto`; typical local: `OLLAMA_MODEL=gemma4:26b` |
| Extract | `maxTokens: 1200`, `temperature: 0`, `json: true`, up to 3 attempts |
| Reply | `maxTokens: 220`, `temperature: 0.7` |
| Tool calling | **None.** No function/tools loop. |
| Raw GDS to LLM | **No.** Only filtered offer summaries. |
| Date math | Prompt *asks* model to resolve dates; regex repairs also exist. Not fully deterministic. |
| Hallucinated fares | Mitigated for reply path (“only AVAILABLE OFFERS”). Extract can invent bad legs/dates. |

**KEEP:** Split extract vs grounded reply; thinking stripped from Ollama output.  
**IMPROVE:** `OLLAMA_NUM_CTX` unset; reply budget too small for multi-city; no agent loop / search strategy tool.

---

## 5. GAL / GDS integration

| Concern | Reality |
|---------|---------|
| Endpoint | Single `POST /api/v1/suppliers/search` |
| Flight shape | One-way or **one round-trip** (`returnDate` → 2 `SearchCriteriaFlight`) |
| True multi-city at GDS | **Not supported** — client fans out N one-ways |
| Offer cap | `TRAVELPORT_MAX_OFFERS` default **12**, truncate **unsorted** on air |
| Baggage / refundability | Server: baggage absent; `refundable: false` hardcode. Client fabricates `baggageKg: 20` |
| Revalidation | **Missing** (booking `revalidatePrice` only re-runs margin on stored net) |
| Fare rules / branded fare | Brand ref parsed; unused; no fare-rules API |
| Search cache | **None** (`cache: "no-store"`); OAuth token cached |
| Queue | No; sync inside HTTP |

Documented detail: [TRAVEL_AI_GDS_FLOW.md](./TRAVEL_AI_GDS_FLOW.md) · existing [integrations/travelport-tripservices.md](./integrations/travelport-tripservices.md).

---

## 6. Itinerary construction & optimization

| Capability | Present? | Mechanism |
|------------|----------|-----------|
| Multi-city NL → legs | Partial | LLM instructions + `splitComplexReturnPlan` regex |
| Open-jaw | Partial | Separate one-ways if model emits them |
| OR origins (LHE\|ISB) | **No** | Model picks one; alt airports only on single-leg comps |
| Exact stay nights | Partial | Regex `layoverDaysFromMessage` / stay nights — fragile |
| Combine legs into priced trip | **No** | Per-leg cards; no trip total |
| Combinatorial generator | **No** | |
| Hard constraint solver | **No** | Post-hoc `applyIntentFilters` only |
| Itinerary optimization | **No** | `curate` angles on single offers; multi-leg → 1/leg |
| Separate-ticket risk | **No** | Always separate searches; risk never labeled |
| Follow-up “make cheaper” | Weak | Re-extract from history; no TravelSession |

---

## 7. Booking flow (isolation)

```text
Chat planning  ──does not call──▶  Booking GDS APIs (none exist)
       │
       ▼
Close / WhatsApp / escalate human
       │
       ▼ (future)
Validated offer ──▶ bookings.service.js state machine ──▶ Travelport Book (not built)
```

**KEEP:** Isolation is correct. Planning refactor must not fake ticket/PNR.

---

## 8. State, cache, persistence

| Layer | Status |
|-------|--------|
| Guest TravelSession | **Missing** — client resends `history` each turn |
| Server Conversation | Exists for **authed** stub chat only |
| Booking / JourneyWatch | Prisma models present; not Ava planning state |
| Search result cache | Missing |
| Metrics (GDS/LLM counts) | Extract has `logStage`; no session metrics registry |

---

## 9. Tests (consultant-relevant)

| Suite | Covers |
|-------|--------|
| `orchestrator.test.ts` | Plan branches, multi-leg fan-out, diversification |
| `travelPlan.test.ts` | Parse/repair, `splitComplexReturnPlan`, home leg |
| `consultantFixes.test.ts` | Close honesty, filters, complex guardrails (incl. exemplar scenario degrade) |
| Travelport | `normalize.duration.test.js` only |
| Missing | Route SSE, real GDS, revalidation, itinerary solver, shadow compare |

---

## 10. LLM problem analysis

| Question | Finding |
|----------|---------|
| Too much raw GDS to Gemma? | **No** for reply. Extract sees only chat text. |
| Hallucinating flights? | Reply constrained. Extract can emit invalid legs/chains. |
| Calculating dates? | **Yes, partly** — prompt + regex, not a date engine. |
| Comparing hundreds of offers? | **No** — ≤12 GDS/leg, curated to 3–4 cards. |
| Deciding availability? | Indirectly via seed fallback masking empties. |
| Unsupported assumptions? | Yes — fabricated baggage, market ×1.08, star default 3. |
| Prompts too large? | Extract system is ~140 lines + history; CTX unset — risk. |
| Context lost between searches? | No session object; history-only. Follow-ups re-plan. |
| Unnecessary searches? | Preferred+open dual call; no dedupe/cache; hotel comps sequential. |

---

## 11. GDS problem analysis

| Question | Finding |
|----------|---------|
| Duplicated searches? | Same body every turn; preferred doubles. |
| Unnecessary searches? | Seed + live mix; comps fan-out on 1-leg. |
| Parallel independent? | Flight legs **yes** (`Promise.all`). Hotel comps **no**. |
| Normalized? | Partial normalize; RT direction bug; layover TZ bug. |
| Fare families? | Upsells requested (2); not modeled for planner. |
| Baggage / rules preserved? | **No.** |
| Cache vs live availability? | Always live search-time price; never revalidated. |

---

## 12. Planning matrix (target exemplar)

> “Best fare from Pakistan, Lahore or Islamabad, to SFO via 2 nights London, 15 days SFO, return from Orlando.”

| Requirement | Current outcome |
|-------------|-----------------|
| LHE **or** ISB | One origin chosen; no fan-out on multi-leg |
| London 2 nights stay | May become legs if extract succeeds; stay not hard-validated on offers |
| SFO 15 days | Same |
| Return from MCO | “Orlando” may fail place map; code `MCO` works |
| Best **complete** fare | Sum of independent OW; no through-fare; no trip ranking |
| Complex fail-safe | If extract fails → honest degrade (`looksComplexForHeuristic`) — **good**, but not solving |

---

## 13. Root causes (why not intelligent enough)

1. **Architecture ceiling:** dual LLM + parallel OW search is a **sales bot over search**, not a planning agent with constraint solving.  
2. **No trip object:** legs priced alone; multi-leg curation collapses to 1 option/hop.  
3. **GDS used as OW proxy:** no multi-city SearchCriteria, no offer-build/revalidate.  
4. **Intent model too thin:** no hard/soft constraints, OR airports, exact stays as first-class types.  
5. **No TravelSession:** refinements restart the world.  
6. **Regex planner** (`splitComplexReturnPlan`) competing with LLM extract — parallel weaker brains.  
7. **Authed vs guest split:** logging in disables real Ava.

---

## 14. Performance bottlenecks (observed shape)

| Factor | Effect |
|--------|--------|
| N legs × (1 or 2) GDS × ≤50s | Latency cliff on multi-city |
| Up to 3 LLM extract attempts + 1 reply | LLM cost/latency stack |
| No search cache | Repeat turns re-hit Travelport |
| Token mint without single-flight | Cold parallel legs multiply OAuth |
| Unthrottled `/api/chat` | Cost/abuse risk |

Quantitative production histograms are **not yet instrumented** (see migration Step 1 metrics).

---

## 15. Accuracy risks (current)

| Risk | Severity |
|------|----------|
| Presenting search-time price as bookable without revalidate | High |
| Fabricated baggage / airlineScore / marketPrice | High for trust |
| Round-trip offer mislabel when `returnDate` used | High if RT path used |
| Soft-empty swallowing auth/timeout on preferred carrier | Medium–High |
| Seed substitution hiding GDS failure | Medium |
| Silent MAX_SEARCH_LEGS truncation | Medium |
| Capability-gap false positive blocking search | Medium |

---

## 16. Verdict

The system is **sound for simple OW/RT shopping with honest sales copy**, and unusually careful about not inventing OTA beats or claiming holds. It is **not yet an itinerary planner**. The right move is incremental evolution toward the target architecture — not a rewrite of Travelport credentials, booking state machine, pricing, or guest chat UX.

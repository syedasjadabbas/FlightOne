# Travel AI — Migration Plan

Incremental path from today’s dual-LLM sales orchestrator to the [target architecture](./TRAVEL_AI_TARGET_ARCHITECTURE.md).  
**Constraint:** preserve guest chat, GDS credentials, pricing honesty, close/WhatsApp, booking state machine.

**User checkpoint:** documentation review before Phase 4+ code (requested docs-only).

---

## 1. Phased sequence (required)

| Phase | Name | Deliverable | Break risk |
|-------|------|-------------|------------|
| 1 | Repository audit | Done — [AUDIT](./TRAVEL_AI_ARCHITECTURE_AUDIT.md) | None |
| 2 | Architecture documentation | Done — this set of docs | None |
| 3 | Identify bottlenecks | §2 below + audit §13–15 | None |
| 4 | Canonical models | `lib/travel/canonical/*` + mappers from DTO | Low |
| 5 | Travel intent schema | Zod `TravelIntent`; adapter from `TravelPlan` | Low |
| 6 | Constraint engine | Hard/soft predicates + tests | Low |
| 7 | Itinerary builder | Combine OW → Trip candidates | Medium |
| 8 | Optimization layer | Rank trips; keep single-leg curate | Low |
| 9 | Orchestrator thin shell | Split `orchestrator.ts`; same `/api/chat` | Medium |
| 10 | Gemma on new layer | Extract → intent; reply on trip shortlist | Medium |
| 11 | Revalidation | Server endpoint + shortlist hook | Medium (needs TP API) |
| 12 | Tests | Matrix §5 | — |
| 13 | Shadow comparison | Flag + metrics log | Low |
| 14 | Production migration | Flag flip; remove dead paths | High — gated |

---

## 2. Bottlenecks to attack first (Phase 3 summary)

Priority order (effort × impact on exemplar trip):

1. **No trip total / 1-offer-per-leg multi-city** — planner value unlock.  
2. **No OR-origin / metro strategy** — LHE|ISB, LON airports.  
3. **No hard stay validation** — London 2n, SFO 15d.  
4. **No search cache / dedupe** — cost + latency.  
5. **No revalidation** — accuracy.  
6. **GDS multi-leg + RT normalize bugs** — correctness when used.  
7. **Fabricated baggage/market** — trust.  
8. **TravelSession** — follow-ups.  
9. **Authed Ava stub** — product consistency (parallel track).

---

## 3. Compatibility strategy

```text
TravelPlan (today) ──adapter──▶ TravelIntent (new)
Offer / OfferCard (UI) ◀──mapper── Trip | FlightOffer
/api/chat request/response bytes: UNCHANGED
SSE event types: UNCHANGED
Booking APIs: UNTOUCHED until Phase 11+ book adapters
```

Feature flag:

```text
TRAVEL_AI_PLANNER=legacy|new|shadow
```

Default `legacy` until Phase 14.

---

## 4. Step mapping to user Steps 1–14

| User step | Migration phase | Notes |
|-----------|-----------------|-------|
| Logging/tracing | 4–9 start | Metrics module first week of code |
| Canonical models | 4 | |
| Wrap GAL interface | 4–5 | Thin facade over `searchSuppliers` |
| Structured intent | 5 | |
| TravelSession | 5–9 | Memory keyed by client `sessionId` first |
| Constraint engine | 6 | |
| Itinerary builder | 7 | |
| Optimization | 8 | |
| Orchestrator | 9 | |
| Move Gemma | 10 | |
| Revalidation | 11 | Depends on server TP work |
| Parallel old/new | 13 | Shadow |
| Compare / switch | 13–14 | |

---

## 5. Test matrix (Phase 12)

| Case | Assert |
|------|--------|
| Simple OW LHE→LHR | Legacy parity |
| RT LHE↔SFO | Parity; if RT GDS used, direction labels correct |
| Multi-city LHE→LHR→SFO→MCO→LHE | Legs + trip total + home |
| Open jaw LHE→SFO, MCO→LHE | Intent + no forced middle |
| Multi-origin LHE\|ISB | Both origins searched or clarify |
| Stopover London 2n exact | Hard reject wrong stays |
| Long stay SFO 15d | Hard reject |
| Follow-up “make cheaper” | Session reuse; soft widen |
| Impossible connection | Rejected, not shown |
| Price change on revalidate | Old/new surfaced |
| Separate tickets | Risk field present |

Prefer pure unit tests on intent/constraints/itinerary/optimize; orchestrator with mocked GDS (existing pattern).

---

## 6. Server workstream (parallel, minimal)

1. Soft-empty error discrimination.  
2. Search cache + auth single-flight.  
3. Sort-before-truncate; preserve `e2eTrackingId`.  
4. Multi-leg `legs[]` in validator + `search.js` (when certified).  
5. `POST /suppliers/revalidate`.  
6. Stop silent baggage/refundable lies — return `unknown`.

Do not block client planner Phases 4–10 on (4)–(5); label `search_only`.

---

## 7. Shadow mode

```text
if TRAVEL_AI_PLANNER=shadow:
  resultLegacy = await runLegacy(...)
  resultNew = await runNew(...).catch(log)
  logCompare(sessionId, metrics)
  return resultLegacy to user
```

Compare fields: trip total (or min OW sum), offer count, GDS call count, latency, hard-constraint pass rate, recommendation id set overlap.

---

## 8. Breaking changes policy

Allowed only with explicit doc + flag:

- Changing `/api/chat` response shape.  
- Requiring login for guest Ava.  
- Removing seed fallback without replacement messaging.  
- Calling Travelport Book from chat without confirmation UX.

Preferred: additive fields on `ConsultantResponse` (`trips?`, `metrics?`) ignored by old UI.

---

## 9. Definition of done (Phase 14)

- [ ] Exemplar NL trip produces 3–5 trips with hard stays satisfied in automated tests (mocked GDS).  
- [ ] Shadow metrics show ≤ legacy GDS calls median for multi-city **or** better constraint satisfaction at similar call count.  
- [ ] Simple OW/RT/hotel golden tests green.  
- [ ] No Gemma path receives raw GDS JSON.  
- [ ] Booking/close flow unchanged.  
- [ ] Docs updated; `docs/README.md` links current.  

---

## 10. Immediate next action after doc review

When implementation is approved:

1. Add `lib/travel/metrics` + request-scoped counters in orchestrator (non-breaking).  
2. Add canonical types + map from `dtoToFlightOffer` (parallel types, no switch).  
3. Add `TravelIntent` Zod + bidirectional adapter with `TravelPlan`.  
4. Character tests for London 2n / SFO 15d stay math (pure functions).

No orchestrator cutover until adapters and stay math are green.

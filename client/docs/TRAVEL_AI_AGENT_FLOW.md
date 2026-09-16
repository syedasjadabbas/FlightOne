# Travel AI — Agent Flow

**Today** vs **target** agent behavior for Ava / Gemma. Source of truth for implementation sequencing with [TRAVEL_AI_MIGRATION_PLAN.md](./TRAVEL_AI_MIGRATION_PLAN.md).

---

## 1. Current agent flow (as coded)

```text
USER MESSAGE
    │
    ▼
Rules: greeting? → welcome (no LLM)
    │
    ▼
Rules: capability gap? → canned (no inventory)
    │
    ▼
Rules: close? → collect PII / WhatsApp policy
    │
    ▼
LLM #1 extractTravelPlan  ──JSON──▶ TravelPlan
    │         │
    │         └─ repair ×2 on bad JSON / strict mode
    ▼
Deterministic repair:
  coercePlanToUserProduct
  guardPlanPassengers
  splitComplexReturnPlan / ensureReturnHomeLeg
    │
    ├─ clarify / close / off_topic / package / search
    │
    ▼ (search)
Promise.all(SearchLeg → Travelport)
    │
    ▼
applyIntentFilters · softFilterOffers
priceOffer · curate / curateMultiLeg
    │
    ▼
LLM #2 buildSystemPrompt + AVAILABLE OFFERS
    │
    ▼
SSE tokens + OfferCards
```

**Properties:** 0–2 LLM generations of planning (extract only); no tool loop; no “search again?” decision; multi-city = N independent OW searches; reply cannot invent prices.

**Files:** `orchestrator.ts`, `extractTravelPlan.ts`, `prompt.ts`, `travelPlan.ts`, `close.ts`, `serviceMessages.ts`.

---

## 2. Target agent flow

```text
USER REQUEST
    │
    ▼
LOAD TravelSession (if any)
    │
    ▼
PARSE INTENT  (Gemma JSON → TravelIntent)
    │         validate schema + leg chain + dates
    │         backend stay calculator fills absolute dates
    ▼
CHECK MISSING INFORMATION
    │  hard gaps → clarify (no GDS)
    ▼
CREATE SEARCH PLAN
    │  expand airports, OR origins, round budgets
    ▼
EXECUTE GDS SEARCHES  (parallel, deduped, cached)
    │
    ▼
NORMALIZE → CANONICAL OFFERS
    │
    ▼
GENERATE ITINERARIES (combinatorial + temporal)
    │
    ▼
APPLY HARD CONSTRAINTS (reject)
    │
    ▼
OPTIMIZE + SOFT SCORE → shortlist
    │
    ▼
SHOULD SEARCH AGAIN?
    │  deterministic heuristics (± optional Gemma advise)
    │  YES → next plan under MAX_SEARCH_ROUNDS
    │  NO  ↓
    ▼
REVALIDATE shortlist
    │
    ▼
GEMMA ANALYSIS (facts locked)
    │
    ▼
FINAL RESPONSE
    │  update TravelSession
    ▼
FOLLOW-UP next turn uses session
```

---

## 3. Responsibility split by step

| Step | Owner | LLM role |
|------|-------|----------|
| Parse intent | Backend validates; Gemma proposes | Structured JSON only |
| Dates / stays | Backend | None |
| Missing info | Backend rules + Gemma ask text | Phrasing |
| Search plan | Backend strategy | Optional “what to try next” later |
| GDS execute | Backend | None |
| Combine / constraints / optimize | Backend | None |
| Revalidate | Backend | None |
| Explain / recommend | Gemma | Narrative only over shortlist |
| Transactional book | Out of agent; confirmation required | Forbidden without user |

---

## 4. Follow-up turns

| User says | Target behavior |
|-----------|-----------------|
| “Make it cheaper” | Soft objective → cheapest; widen soft dims; reuse session searches; ask before dropping hard stay |
| “Prefer Emirates” | Soft preference or hard `airlinesOnly` if exclusive language |
| “Leave a day later” | Backend shifts dates; invalidate date-keyed cache; re-search |
| “Book option 2” | Existing close path / future booking handoff — not auto-ticket |

Current gap: each turn re-extracts from history alone — treat as IMPROVE via `TravelSession`.

---

## 5. Prompt contracts (target)

### Intent extract

- Output **only** schema-valid `TravelIntent`.  
- Prefer `clarify` over guessing hard facts (dates, party size when ambiguous).  
- Never emit flight numbers or prices.

### Final analysis

Inputs only:

```text
USER REQUIREMENTS
VALIDATED CANDIDATES (prices, times, stays, ticket construction)
OPTIMIZATION CRITERIA
CONSTRAINT STATUS
IMPORTANT TRADEOFFS
```

Rules:

- Do not modify factual values.  
- Do not invent information.  
- Do not calculate prices.  
- Do not claim availability unless revalidated.  
- Explain and recommend.

Reply format: human-friendly options (Cheapest / Best Value / Fastest) with trip totals from backend. Scale length with candidate count (drop “2–3 sentences forever” for multi-city).

---

## 6. Loop limits

| Knob | Purpose |
|------|---------|
| `MAX_SEARCH_ROUNDS` | Cap iterative widen |
| `MAX_GDS_REQUESTS_PER_SESSION` | Cost ceiling |
| `MAX_CANDIDATES` | Combinatorial explosion |
| `MAX_WALL_MS` | Chat UX SLA |
| Extract repair attempts | Keep today’s 3 | 

On limit: return best feasible shortlist + honest scarcity language (existing voice rules).

---

## 7. Tool permission levels (when tools exist)

| Class | Tools | Gate |
|-------|-------|------|
| READ | resolve_location, search_*, get_fare_*, get_baggage, get_trip_state | Automatic |
| VALIDATE | revalidate_offer | Automatic on shortlist |
| TRANSACTIONAL | createPNR, issueTicket, cancel, refund | Explicit user confirmation |

Until tools ship, the **orchestrator implements the same permission semantics** (never call book from chat).

---

## 8. Streaming UX (preserve)

Keep SSE phases:

`extract` → `search` → `reply` tokens → `offers` → `done`

New planner should emit the same event types (`streamTypes.ts`) so the frontend does not break.

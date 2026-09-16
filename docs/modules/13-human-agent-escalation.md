# Module 13 — Human Agent Escalation

**PRD Module 13** · Prefix: `ESC` · Phase: 1

## Objective (from PRD)

Transfer customers to a live consultant when requested, for VIP bookings, complex
itineraries, supplier failures, refund disputes, medical assistance, or special service
requests — with the complete AI conversation history accompanying the transfer.

## Dependencies

- Module 01 (source of the conversation being escalated)
- Module 03/05 (booking/pricing context at the point of escalation)
- Module 00 (agent identity/entitlements for consultant queue access)
- Module 09 (journey rebook handoff — quote-required, never auto-book)
- Module 14 (refund/reissue write-back via existing refund case state machine)

## Core concepts

- Escalation is a **first-class exit path from every AI-driven flow**, not a Module-01-only
  feature — booking, refunds, and corporate approvals all need it (docs/README.md
  cross-cutting principle #4).
- **Zero context loss** is the hard requirement: a consultant picking up a handoff must see
  everything the AI saw, not a summary that drops details.

## Checklist

### Trigger detection
- [x] Explicit customer request ("talk to a human") from any AI surface
- [x] VIP customer detection (tier/segment-based auto-escalation) — gated by
      `ESCALATION_VIP_REWARD_TIERS` (no fabricated VIP)
- [x] Complex itinerary detection (multi-city, unusual routing, group + corporate overlap)
- [x] Supplier failure detection (adapter circuit-breaker trip, repeated booking failure)
- [x] Refund dispute detection (customer disagrees with a Module 14 calculation)
- [x] Medical assistance request keyword/intent detection
- [x] Special service request detection (wheelchair, unaccompanied minor, etc.)
- [x] AI discount-limit-exceeded trigger (from Module 05)

### Handoff
- [x] Full conversation history transferred verbatim (not summarized/truncated)
- [x] Current booking/pricing/traveller context attached to the handoff
- [x] Consultant queue with routing (by skill/language/VIP tier) — permission pools;
      language filter only when `ESCALATION_LANGUAGE_PERMISSION_MAP` is configured;
      no invented availability / auto-assignment
- [x] Customer-visible status during handoff ("connecting you to a specialist")
- [~] Warm handoff option (AI stays visible/available while consultant joins) vs cold
      handoff (full transfer) — **PRODUCT_DECISION_DEFERRED**: FlightOne Doc.pdf Module 13
      only requires live-consultant transfer + full conversation history. Implemented mode
      is **COLD** (`Conversation` → `ESCALATED`, full `contextSnapshot`). Warm co-presence,
      typing indicators, SLA timers, and live availability are not built.

### Post-escalation
- [x] Consultant actions (booking cancel, refund process/reject, journey rebook handoff)
      recorded back into Module 03 / 09 / 14 state machines via `POST /escalations/:id/actions`
      — not a parallel booking SM; server-side pool + assignee + permission checks; audit
      `escalation.consultant_action`; idempotent keys; provider gaps → `EXTERNAL_DEPENDENCY`
- [x] Resolution outcome logged (`resolutionOutcome` + `LOG_RESOLUTION_OUTCOME` action) for
      AI quality review

## Business rules / invariants

- No escalation may drop conversation history — this is treated as a data-loss bug, not a
  UX nitpick.
- Actions a human consultant takes after escalation still go through the same server-side
  authority checks (pricing/policy) as AI or customer actions — a human agent is a different
  actor, not a bypass of the invariants in Module 03/05/06.
- Do not mark booking/service success until the underlying Module 03/09/14 operation succeeds.

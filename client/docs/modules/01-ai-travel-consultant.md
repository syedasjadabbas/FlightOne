# Module 01 — AI Travel Consultant

**PRD Module 1** · Prefix: `ATC` · Phase: 1 (core chat) → 3 (Voice AI, Autonomous Concierge)

## Objective (from PRD)

The conversational front door of the platform: understand natural-language travel intent,
ask follow-up questions, refine requirements, and hand off a structured request to the
Booking Engine (Module 03) and Recommendation Engine (Module 04) — never overwhelming the
customer with raw search results itself.

## Dependencies

- Module 00 (identity of the conversing user)
- Module 02 (customer profile/preferences to personalize responses)
- Module 16 (AI Knowledge Platform — grounds answers in real SOPs/fare rules instead of
  hallucinating)
- Module 13 (Human Agent Escalation — the conversation's designated exit valve)

## Core concepts

- The AI Travel Consultant **proposes**; it never has final authority on price or booking
  commitment (enforced in Module 03/05 per the dev guide's server-authority rule).
- A conversation is a **persistent, resumable thread** tied to the customer identity, not a
  stateless request/response pair.
- Follow-up questions exist to **reduce** the search space before calling suppliers, not to
  interrogate the customer — minimize round-trips to a satisfying itinerary.

## Checklist

### Conversation core
- [ ] Persistent conversation thread per customer, resumable across sessions/devices
- [ ] Natural-language intent extraction (origin, destination, dates, pax, cabin, budget,
      trip purpose)
- [ ] Multi-turn slot-filling: ask only for missing/ambiguous fields, not a rigid form
- [ ] Disambiguation prompts (e.g. "Islamabad — did you mean ISB airport or the city?")
- [ ] Constraint refinement mid-conversation ("actually, no red-eye flights")
- [ ] Explanation of *why* a recommendation was made (ties into Module 04's ranking factors)
- [ ] Handles trip-type variety: one-way, round-trip, multi-city, hotel-only, flight+hotel
- [ ] Graceful handling of out-of-scope requests (non-travel questions) — redirect, don't
      hallucinate an answer

### Personalization & memory
- [ ] Reads traveller preferences from Module 02 (seat, meal, loyalty programs) to pre-fill
      searches without re-asking every time
- [ ] Learns from accepted/rejected recommendations over time (feedback loop into Module 04)
- [ ] Recognizes returning customers' common routes/patterns ("your usual ISB–DXB?")

### Cross-device continuity
- [ ] Conversation state synced server-side, not device-local only
- [ ] Handoff between channels (web chat, WhatsApp, mobile app) preserves full context

### Guardrails
- [ ] Every AI-proposed itinerary/price is re-validated server-side before being presented
      as bookable (never trust the LLM's arithmetic or memory of a quote)
- [ ] Explicit escalation trigger when the AI detects it's out of its depth (Module 13)
- [ ] Rate/cost controls on LLM calls (avoid runaway token spend per conversation)
- [ ] Logging of AI decisions/recommendations for later audit and quality review

### Phase 3 extensions
- [ ] Voice AI channel (speech-to-text/text-to-speech front end on the same conversation
      engine)
- [ ] Autonomous Travel Concierge — proactive suggestions without an explicit user prompt
      (e.g. rebooking suggestions after a schedule change), still gated by Module 13 escalation
      rules and Module 03 booking authority

## Business rules / invariants

- The AI never books, charges, or issues a document on its own authority — every commitment
  passes through Module 03/05's server-side checks.
- Conversation history is retained and attached in full on any escalation (Module 13).
- Knowledge used to answer policy/fare questions must be sourced from Module 16, not the
  model's general training — flag and log any answer that couldn't be grounded.

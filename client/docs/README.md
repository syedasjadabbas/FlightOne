# FlightOne AI-TOS — Documentation

This folder is the engineering source-of-truth derived from the **FlightOne AI Travel
Operating System PRD (v1.0)**. It follows the same documentation pattern as the sister ERP
platform (`accounts-client/docs/`) — same section structure, same checklist convention —
so engineers moving between the two codebases don't need to relearn how docs are organized.

## Start here

- **[PRODUCT.md](../PRODUCT.md)** — plain-English product brief for any AI coding tool
  (what FlightOne is, who it serves, what this repo is building, hard invariants).
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** — mandatory architecture & conventions
  for client and server. Read this before writing any code. *(Note: some “scaffold-only”
  assumptions in this guide are stale — `filght-one-server` and Ava chat are live.)*
- **Travel AI planning refactor (2026-08)** — audit and target design **before** implementation:
  - [TRAVEL_AI_ARCHITECTURE_AUDIT.md](./TRAVEL_AI_ARCHITECTURE_AUDIT.md) — current system as coded
  - [TRAVEL_AI_TARGET_ARCHITECTURE.md](./TRAVEL_AI_TARGET_ARCHITECTURE.md) — evolve-to architecture
  - [TRAVEL_AI_AGENT_FLOW.md](./TRAVEL_AI_AGENT_FLOW.md) — Gemma vs backend responsibilities
  - [TRAVEL_AI_GDS_FLOW.md](./TRAVEL_AI_GDS_FLOW.md) — Travelport/GAL path and gaps
  - [TRAVEL_AI_OPTIMIZATION.md](./TRAVEL_AI_OPTIMIZATION.md) — per-offer vs itinerary ranking
  - [TRAVEL_AI_MIGRATION_PLAN.md](./TRAVEL_AI_MIGRATION_PLAN.md) — phased cutover + shadow mode
- **Module checklists** (below) — one file per PRD module, each a buildable checklist of
  functionality traced back to the PRD's "shall" statements plus the elaboration needed to
  actually build it (data model, states, edge cases).
- **[STAKEHOLDER_QUESTIONS.md](STAKEHOLDER_QUESTIONS.md)** — open workflow/business-rule/
  vendor questions for product, ops, finance, and legal, surfaced while writing the module
  checklists. Answer these before finalizing designs in the modules they block.
- **[integrations/](integrations/)** — supplier API research and adapter notes (Travelport
  TripServices / Galileo live; [TPConnects Iris](./integrations/tpconnects-iris.md)
  researched; RateHawk later).
- **[PROTOTYPE_SALES_BOT.md](./PROTOTYPE_SALES_BOT.md)** — earlier map of the dual-LLM sales
  pipeline (still useful; supersede planning gaps with the Travel AI docs above).

## Module checklists

**Status legend:** ✅ done · 🟡 in progress · ⬜ not started.

Everything below is ⬜ — this repo is currently a bare `create-next-app` scaffold with no
product code. Update the status column as work lands.

| # | Module | Phase | Prefix | Status | Doc |
|---|--------|-------|--------|--------|-----|
| 00 | Foundation & Security | 1 | FND/SEC | ⬜ | [modules/00-foundation-security.md](modules/00-foundation-security.md) |
| 01 | AI Travel Consultant | 1 → 3 | ATC | ⬜ | [modules/01-ai-travel-consultant.md](modules/01-ai-travel-consultant.md) |
| 02 | Customer Identity & Profile | 1 | CIP | ⬜ | [modules/02-customer-identity-profile.md](modules/02-customer-identity-profile.md) |
| 03 | AI Booking Engine | 1 | BKG | ⬜ | [modules/03-ai-booking-engine.md](modules/03-ai-booking-engine.md) |
| 04 | Intelligent Recommendation Engine | 1 → 3 | REC | ⬜ | [modules/04-recommendation-engine.md](modules/04-recommendation-engine.md) |
| 05 | Pricing & Margin Engine | 1 | PRC | ⬜ | [modules/05-pricing-margin-engine.md](modules/05-pricing-margin-engine.md) |
| 06 | Corporate Travel | 1 → 3 | CORP | ⬜ | [modules/06-corporate-travel.md](modules/06-corporate-travel.md) |
| 07 | Traveller Vault | 1 → 2 | VAULT | ⬜ | [modules/07-traveller-vault.md](modules/07-traveller-vault.md) |
| 08 | Visa Intelligence | 2 | VISA | ⬜ | [modules/08-visa-intelligence.md](modules/08-visa-intelligence.md) |
| 09 | Live Journey Management | 2 | JRN | ✅ | [modules/09-live-journey-management.md](modules/09-live-journey-management.md) |
| 10 | Rewards & Referrals | 2 | RWD | ✅ | [modules/10-rewards-referrals.md](modules/10-rewards-referrals.md) |
| 11 | Group Travel | 2 | GRP | ✅ | [modules/11-group-travel.md](modules/11-group-travel.md) |
| 12 | MICE Platform | 2 | MICE | ✅ | [modules/12-mice-platform.md](modules/12-mice-platform.md) |
| 13 | Human Agent Escalation | 1 | ESC | ⬜ | [modules/13-human-agent-escalation.md](modules/13-human-agent-escalation.md) |
| 14 | Refund & Reissue Engine | 1 → 2 | RFD | ⬜ | [modules/14-refund-reissue-engine.md](modules/14-refund-reissue-engine.md) |
| 15 | Operations Platform | 1 | OPS | ⬜ | [modules/15-operations-platform.md](modules/15-operations-platform.md) |
| 16 | AI Knowledge Platform | 1 | KB | ⬜ | [modules/16-ai-knowledge-platform.md](modules/16-ai-knowledge-platform.md) |
| 17 | Management Dashboard | 1 → 3 | DASH | ⬜ | [modules/17-management-dashboard.md](modules/17-management-dashboard.md) |

### Notes on phase mapping and module 00

The PRD's roadmap (Phase 1/2/3) lists *features*, not modules 1:1 — several modules span
phases (an MVP slice in Phase 1, deeper functionality later). The table above maps each
module to where its **first usable slice** lands, with `→` marking modules that grow further
in a later phase.

**Module 00 (Foundation & Security)** is not in the PRD's numbered module list but is added
here the same way the ERP docs add "01-foundation-security" — auth, identity/session,
RBAC/entitlements, and the security service are cross-cutting infrastructure that every
other module depends on from day one. Building it as an implicit side-effect of Module 02
instead of its own tracked module is how foundational security work quietly falls through
the cracks.

Two modules are pulled forward relative to their most obvious PRD phase, with rationale:
- **Module 13 (Human Agent Escalation)** is marked Phase 1, not later — shipping the AI
  Booking Engine (Module 03) without an escalation path is a support and trust risk from the
  first customer booking, not a Phase 2 nice-to-have.
- **Module 16 (AI Knowledge Platform)** is marked Phase 1 at a basic level — the AI Travel
  Consultant (Module 01) needs *some* grounding in real SOPs/policies/fare rules to avoid
  hallucinating travel advice from day one; a full knowledge platform can still grow in
  later phases.

## Cross-cutting principles (apply to every module)

1. **The server is the authority on price, policy, and state** — the AI layer and the client
   propose; nothing is committed (payment captured, ticket issued, refund calculated) without
   a server-side re-check. See [DEVELOPMENT_GUIDE.md §7](DEVELOPMENT_GUIDE.md#7-flightone-specific-server-rules-from-the-prd).
2. **Every booking has an explicit, auditable state machine.** No module should invent its
   own ad hoc status field — states and transitions live in one place (Module 03) that other
   modules read/react to.
3. **Audit logging is immutable and append-only** for every create/edit/approve/issue/refund
   action, mirroring the ERP platform's audit invariant.
4. **Human escalation is a first-class exit** from every AI-driven flow, not just the chat
   module — booking, refunds, and corporate approvals all need a "hand this to a person" path.
5. **Supplier integrations are adapters, not hardcoded calls** — Galileo (via Travelport
   TripServices) and RateHawk today, more suppliers later, without rewriting booking/pricing
   logic per supplier. See [integrations/](integrations/).
6. **Documents expire; the system should know before the customer finds out the hard way** —
   passports, visas, residence permits all need proactive expiry tracking (Modules 02/07/08).

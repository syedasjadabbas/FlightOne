# Stakeholder Questions — FlightOne AI-TOS

The PRD specifies *what* the platform should do; it doesn't specify enough of the *how* to
start building safely. This is the list of workflow, business-rule, and vendor questions
that came up while writing the [module checklists](modules/) — each one blocks a design
decision (data model, state machine, or integration contract) somewhere downstream.

**How to use this doc:** work top-down with product/ops/finance/legal stakeholders. As
answers land, fold them into the relevant module doc's "Core concepts" or "Business rules"
section and delete the question from here (or move it to a "resolved" section if you want a
paper trail).

---

## 0. Cross-cutting / platform-wide

These affect architecture decisions in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) and
almost every module — answer these first.

1. **Ticketing authority:** Is FlightOne IATA-accredited to issue tickets directly, or does
   ticketing route through a consolidator/BSP? This determines who Module 03's ticketing
   adapter actually talks to and what settlement/reporting obligations exist.
2. **Payment gateway(s):** Which one(s), for which markets/currencies? Any that support
   corporate invoicing/net terms natively (Module 06), or is that built in-house?
3. **Regulatory scope:** What data-protection regime applies (PECA/local law, GDPR if EU
   travellers are in scope)? Is there a PCI-DSS scope decision already made, or does that
   need a compliance review before Module 00's design is final?
4. **AI vendor/model:** Which LLM provider? Does sending customer PII (passport numbers,
   payment context) to that provider raise data-residency or contractual concerns?
5. **Infra:** Does `flight-one` get its own Postgres instance, or share the existing
   DigitalOcean/PgBouncer instance with `crm-server`/`accounts-client`? This is called out
   as an open assumption in the dev guide and needs an explicit answer before a server repo
   is provisioned.
6. **"90% AI-handled" metric:** How is this actually measured — % of bookings completed
   without any Module 13 escalation? % of conversations? % of revenue? Module 17's dashboard
   can't build this widget without a precise definition.
7. **Consultant staffing model:** In-house or outsourced? What hours/timezones have live
   coverage? Module 13 needs this to design the "no agents available" fallback behavior.
8. **Localization:** Confirmed languages at launch (English/Urdu/Arabic assumed from the
   sister platforms) — is that right for FlightOne's actual customer base, or different?
9. **Brand/design system:** Does one exist yet, or does this need a design pass before UI
   work starts (flagged as missing in the dev guide)?

---

## 1. Module 01 — AI Travel Consultant
- Which channels ship at launch — web chat only, or web + WhatsApp + mobile simultaneously?
- After how many failed clarification turns should the AI auto-escalate (Module 13) instead
  of continuing to guess?
- Is there a per-conversation LLM cost budget/ceiling, and what happens when it's hit?
- Is proactive AI messaging (price-drop alerts, rebooking suggestions) in scope for Phase 1
  in any form, or strictly Phase 3 (Autonomous Concierge)?
- What compliance/disclaimer language is required when the AI discusses pricing, refund
  eligibility, or visa requirements (avoiding implied guarantees)?

## 2. Module 02 — Customer Identity & Profile
- Which documents are mandatory before a booking can be made vs. optional/stored for later
  (e.g., can a domestic flight be booked with zero documents on file)?
- Who sets expiry-notification lead times — fixed product default, or configurable per
  document type/destination country (some visas require 6-month passport validity, not just
  "not expired")?
- Do family members/companions need their own login, or can they exist as dependents with no
  account of their own?
- Is document authenticity verified (manual review, OCR, third-party ID-verification
  service), or is self-reported data trusted at launch?
- Does "right to be forgotten" conflict with any regulatory record-retention requirement for
  travel documents?

## 3. Module 03 — AI Booking Engine
- What's the reservation/hold TTL before an unpaid PNR or hotel hold auto-releases?
- Are ancillaries (baggage, seat selection, meals) in scope for Phase 1, or added later?
- Can passengers on one booking have different itineraries, or is it always one shared
  itinerary per booking?
- After ticketing, do changes route back through FlightOne always, or can a customer modify
  directly with the airline/GDS in some cases?
- What's the no-show policy/workflow for hotels vs. flights — same handling or different?

### Travelport / Galileo (flights supplier)
Context: [integrations/travelport-tripservices.md](integrations/travelport-tripservices.md).

- Does FlightOne already have a Travelport agency agreement, PCC, and MCN — or do we need
  a sales inquiry / trial credentials first?
- What should the provisioned PCC default currency be (PKR vs USD + Module 05 FX)?
- For a Lahore leisure POS, which content matters at launch (PIA, Gulf carriers, South/SE
  Asia LCCs)? Has anyone validated coverage in Travelport pre-prod?
- Are private / net / consolidator fares (and airline account codes) required for package
  pricing in Phase 1?
- Phase 1 flights: GDS-only, or are specific NDC carriers required at launch?
- Who owns Travelport certification (ops vs engineering) and the ≥15-day production notice?

## 4. Module 04 — Recommendation Engine
- When ranking factors conflict (cheapest vs. customer's preferred airline), what's the
  priority order — and is that order configurable or hardcoded?
- Is airline on-time-performance data licensed from a third party (OAG, Cirium, etc.)? Who
  owns that vendor decision/budget?
- Is there a hard cap on "show more options," or should it behave like a full OTA list once
  a customer asks to see more?

## 5. Module 05 — Pricing & Margin Engine
- What's the actual markup model — flat %, tiered by route/season, or dynamic/ML-driven?
- Who owns changing the AI's discount ceiling — product, finance, or revenue management? How
  often does it change?
- Are promo codes managed by a marketing system that needs integration, or built in-house
  from scratch?
- What FX rate source/provider is used for multi-currency pricing, and how often does it
  refresh?

## 6. Module 06 — Corporate Travel
- What's the corporate onboarding flow — self-serve signup, or sales-assisted contract
  setup with manual account provisioning?
- How deep does the approval chain go (single approver vs. multi-level with delegation for
  OOO)?
- Are corporate credit limits collateralized (deposit/bank guarantee) or trust-based? Who
  owns credit-risk decisions?
- What billing terms are offered (net-30/60)? Who owns collections/dunning for overdue
  corporate invoices?
- Can an employee book personal travel "as a guest" under a corporate context without a full
  profile switch, or is switching always mandatory?

## 7. Module 07 — Traveller Vault
- What file formats/size limits apply to uploaded documents?
- Beyond the traveller themselves, who else can access vault contents — corporate admins,
  consultants during an escalation, support agents resolving a ticket issue? What's the
  access-logging expectation for each?
- Is MRZ/OCR auto-extraction from passport scans in scope for Phase 1 (reduces manual entry
  significantly) or a later enhancement?
- Retention period for tickets/vouchers post-trip — indefinite, or time-bound?

## 8. Module 08 — Visa Intelligence
- What's the actual data source for visa-requirement rules — a licensed visa-data API, or an
  internally curated/maintained database? Who owns keeping it current?
- Is FlightOne offering paid visa application assistance/processing, or purely informational
  guidance with no liability for the application outcome?
- What's the liability/disclaimer stance if visa information is wrong and a customer is
  denied boarding or entry?

## 9. Module 09 — Live Journey Management
- What's the data source for flight status/gate/delay info — direct airline feed, the GDS
  itself, or a third-party aggregator (FlightAware, Cirium, etc.)? What's the cost model?
- What WhatsApp Business API provider is used, and has the message-template approval process
  (required for proactive WhatsApp notifications) been started?
- Is there an SLA on notification latency (e.g., must notify within N minutes of a gate
  change)?
- Are hotel check-in and airport transfer statuses available via supplier API, or does this
  rely on manual status updates from providers who don't expose one?

## 10. Module 10 — Rewards & Referrals
- What's the actual rewards design — points-per-spend, flat amount per booking, cashback, or
  something else? Is there an existing loyalty-program spec, or does this need designing
  from scratch?
- Do points/credits expire, and after what period?
- What abuse/fraud limits apply to referrals (self-referral prevention, velocity caps)?
- For corporate reward programmes: credited to the company or to individual employees — and
  does the latter raise an employee-benefits tax question in any operating jurisdiction?

## 11. Module 11 — Group Travel
- What's the largest group size the platform must realistically support (tens for family/
  corporate tours vs. hundreds for Hajj/Umrah groups)? This affects broadcast/attendance UI
  design directly.
- Who pays for a group booking — one payer for the whole group, or itemized per member?
- What's the consent/data-privacy model for minors in student/family groups (guardian
  consent, visibility restrictions)?
- Are there Hajj/Umrah-specific integrations required (Saudi authorities, Nusuk platform,
  or similar), and are they a Phase 2 hard requirement or a stretch goal?

## 12. Module 12 — MICE Platform
- Is this for FlightOne's own internal/marketing events, a service sold to enterprise
  clients running their own events, or both?
- What's the badge-printing logistics model — on-site printer integration required, or
  pre-printed and shipped in advance?
- Are event sponsors invoiced through the same corporate-billing system as Module 06, or
  handled through a separate sales/finance process?

## 13. Module 13 — Human Agent Escalation
- What's the target response-time SLA for a live handoff — immediate takeover, or a
  callback window? Does this vary by trigger type (VIP vs. general request)?
- Is there 24/7 human coverage? If not, what does the AI say/do when no agent is available?
- What console/tooling do consultants use to pick up a handoff — a purpose-built agent
  console, or an existing helpdesk tool (Zendesk, Freshdesk, etc.) integrated via API?
- How is "VIP" actually defined — revenue threshold, manual flag, or loyalty tier
  (Module 10)?

## 14. Module 14 — Refund & Reissue Engine
- Is FlightOne's agency fee ever refundable, or always non-refundable regardless of airline
  policy?
- What refund-processing-time SLA is communicated to the customer at cancellation time, and
  does it match what suppliers actually take?
- Do disputed refunds always route to Module 13 escalation, or is there a separate
  dispute/appeals workflow?
- Are travel credits transferable to another traveller, or locked to the original account?

## 15. Module 15 — Operations Platform
- Which specific CRM/accounting systems are already in use at FlightOne today (a system
  name, not a generic "CRM") that this must integrate with, vs. systems being built fresh?
- How many distinct commission types need tracking simultaneously (agent commission,
  referral-partner commission, supplier override commission)?
- Who reconciles supplier statements today, and in what format do suppliers actually deliver
  them (EDI, CSV export, portal-only with no export)? This determines whether reconciliation
  can be automated at all in Phase 1.

## 16. Module 16 — AI Knowledge Platform
- Who owns keeping SOPs/airline policies/visa procedures current — a dedicated content/ops
  role, or does engineering need to build a self-serve ingestion tool for non-technical
  staff to use directly?
- When the AI can't find a grounded answer, should it always escalate (Module 13), or is a
  disclaimed best-effort answer acceptable in some cases?

## 17. Module 17 — Management Dashboard
- Who are the actual dashboard users (executives, ops managers, individual consultants,
  corporate admins viewing their own company), and what permission scope does each need?
- What does "real-time" need to mean in practice — sub-second streaming, or a few-minutes-old
  refresh? This changes the caching strategy entirely (dev guide §6.4).

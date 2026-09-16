# FlightOne — Product brief for AI coding tools

**Read this first** if you are an AI (or a human) about to change code in this repo.
It explains *what we are building* in plain English. For *how to build*, use
[`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) and [`AGENTS.md`](AGENTS.md).

Last updated: 31 Jul 2026.

---

## One sentence

**FlightOne** is a Lahore-based travel business that designs **custom international tour
packages for travellers from Pakistan**. This software repo is building an **AI Travel
Operating System** so that business can sell, book, serve, and operate those trips — and
eventually flights, hotels, visas, groups, and corporate travel — through one product
instead of WhatsApp + spreadsheets + supplier portals.

---

## The real-world business (today)

FlightOne Travel already exists as a company. Live marketing site:
[https://www.flightone.co/](https://www.flightone.co/).

What they sell today:

- Custom packages **from Pakistan** (not fixed “inventory packages” sitting on a shelf).
- Typical destinations: Maldives, Dubai, Turkey, Thailand, Malaysia, Singapore, Sri Lanka,
  Morocco, Egypt, and similar.
- A full itinerary (flights, hotels, transfers, day-by-day plan, visa help) promised within
  **24 hours**, free to request, no obligation to book.
- Quotes at **3★ / 4★ / 5★** so the customer can compare comfort vs price.
- Segments: honeymoon, family, group/corporate (10+), solo; add-ons like e-SIM.
- Main conversion path today: **WhatsApp** (`+92 327 777 0170`) and email
  (`info@flightone.co`). Office in Gulberg III, Lahore.

Structured copy, prices, FAQs, and testimonials from that site live in
[`lib/content/flightone.ts`](lib/content/flightone.ts). Stakeholder inventory:
[`docs/stakeholders/flightone-co-content-inventory.md`](docs/stakeholders/flightone-co-content-inventory.md).

**If you invent marketing claims, destinations, or PKR prices, you are wrong.** Prefer the
content module above.

---

## The software product (what this repo is)

Working name: **FlightOne AI Travel Operating System (AI-TOS)**.

Think of it as the **digital backbone** of a modern travel agency:

| Layer | Job in plain English |
|---|---|
| **Front door** | Travellers discover the brand and start a trip (marketing sites, chat with Ava). |
| **Consultant** | An AI agent (Ava) talks like a sales consultant, understands intent, and proposes options. |
| **Booking & pricing** | The *server* decides real prices, availability, and booking state — never the LLM alone. |
| **Traveller account** | Trips, documents (passport/visa), companions, visas, journey updates, rewards. |
| **Corporate / groups / MICE** | Company travel policies, group trips, events — later depth on the same platform. |
| **Ops & management** | Humans (agents, ops, managers) see dashboards, escalate AI chats, handle refunds/reissues. |

The PRD breaks this into numbered modules (`docs/modules/00` … `17`). Those files are the
build checklists. You do not need to memorise them all — open the module you are touching.

### Hard rules that never change (product invariants)

1. **The server owns money and truth.** Ava (or any AI) may *propose* a trip or price. Nothing
   is booked, charged, ticketed, or refunded until server-side checks say yes.
2. **Never invent fares or hotel rates.** Only show numbers that came from inventory /
   pricing code. If there is no offer in context, ask a clarifying question — do not guess.
3. **Human escalation is always available.** AI can fail; a real agent must be able to take
   over with full conversation context.
4. **Supplier systems are adapters.** Today the docs assume things like Galileo / RateHawk;
   tomorrow there will be more. Do not hardcode one supplier into business logic.
5. **Documents expire.** Passports and visas must be tracked before the traveller discovers
   a problem at the airport.
6. **Security is not optional.** Auth, entitlements, and PII handling are Module 00 — every
   other feature sits on top of that.

---

## Who uses it

| Persona | What they want |
|---|---|
| **Leisure traveller** | A custom trip from Pakistan, honest PKR pricing, WhatsApp-easy start, later a logged-in trip home. |
| **Ava (AI consultant)** | Short, sales-oriented chat; close toward a bookable quote without hallucinating. |
| **Human travel agent** | Same tools as Ava when the chat escalates; ops views for bookings and exceptions. |
| **Corporate traveller / approver** | Policy-aware booking and approvals (Module 06). |
| **Ops / management** | Dashboards, refunds, journey disruptions, knowledge/SOPs for the AI. |

---

## What is already in *this* frontend repo (rough map)

Repos:

| Area | Routes / notes |
|---|---|
| Marketing / cinematic home | `/` (Earth Odyssey–styled landing seeded with FlightOne content) |
| Flagship destination showcase | `/flagship` (scroll “Pan-Pop-Flip” sequences with real destination photos) |
| AI chat | `/chat` — Ava |
| Auth | `/login` |
| Traveller product surfaces | `/trips`, `/vault`, `/visa`, `/journey`, `/rewards`, `/groups`, `/mice`, `/corporate`, `/profile`, … |
| Ops | `/dashboard` |
| Broken / out of scope | `/mirror/copula` — do not build on this path |

There is a separate workspace for the API (`filght-one-server` / proposed `flight-one-api`).
Treat server existence and schemas as **something to verify**, not assume from old docs.
`docs/DEVELOPMENT_GUIDE.md` still carries some greenfield notes — check reality before
you invent endpoints.

**Design system:** dark “Earth Odyssey” chrome (void / cream / slate / emerald). Tokens in
`app/globals.css`; docs in `docs/design/`. Do not invent a new visual language.

---

## What this product is *not*

- Not a generic Booking.com clone for the whole world.
- Not primarily a Western corporate TMC platform like [Atriis](https://www.atriis.com/)
  (see `docs/stakeholders/atriis-company-report.md` for competitive literacy only).
- Not “chatGPT with a travel skin” — the LLM is a consultant layer over booking, pricing,
  and ops systems that must stay authoritative.
- Not finished. Many module checklists are still open. Prefer small, correct slices over
  fake completeness.

---

## How you should behave when coding here

1. **Match the business voice** on customer-facing copy: direct Pakistani English,
   WhatsApp-first, transparent PKR, honest about visas (no fake guarantees).
2. **Prefer existing modules and content files** over inventing new product concepts.
3. **Ask when the PRD and the live business disagree** — e.g. leisure custom tours vs full
   corporate OBT. Do not silently pick the flashier option.
4. **Keep marketing routes (`/`, `/flagship`) visual and content-safe**; keep chat/forms
   free of heavy WebGL/Lenis unless the route already uses them on purpose.
5. After non-trivial work, point to what you verified (tests, typecheck, a URL you opened).

---

## Where to go next

| Need | Doc |
|---|---|
| How to structure code, stack, server rules | [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) |
| Engineering behaviour / quality bar | [`AGENTS.md`](AGENTS.md) |
| Per-feature build checklist | [`docs/modules/`](docs/modules/) |
| Live brand / destination content | [`lib/content/flightone.ts`](lib/content/flightone.ts) |
| Docs index | [`docs/README.md`](docs/README.md) |
| Supplier integrations (Travelport / Galileo) | [`docs/integrations/`](docs/integrations/) |
| Open product questions | [`docs/STAKEHOLDER_QUESTIONS.md`](docs/STAKEHOLDER_QUESTIONS.md) |

---

*If this brief conflicts with `AGENTS.md` or the Development Guide on engineering practice,
those win. If it conflicts with live `lib/content/flightone.ts` on business facts, the
content module wins.*

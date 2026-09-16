# FlightOne.co — Stakeholder Content Inventory

**Source:** [https://www.flightone.co/](https://www.flightone.co/)  
**Researched:** 28 Jul 2026  
**Purpose:** Seed the Earth Odyssey product experience with live business content for stakeholder demos.

> **Critical site note:** The live site is effectively a **single-page homepage**. Nav/footer links to destinations, packages, about, contact, visa, e-SIM, and FAQ routes currently return **Vercel 404**. All verbatim copy below is from the live homepage unless marked otherwise.

---

## Brand snapshot

| Field | Value |
|---|---|
| Legal / trading | FlightOne Travel (logo: “Flight One”) |
| Positioning | Custom international tour packages **from Pakistan** — not fixed inventory packages |
| Promise | Full itinerary in **24 hours**. Free to request. No obligation. |
| HQ | 71 C3, Facing Qarshi Park, Gulberg III, Lahore |
| Phone / WhatsApp | +92 327 777 0170 · [wa.me/923277770170](https://wa.me/923277770170) |
| Email | info@flightone.co |
| Hours | Mon–Sat 10:00–19:00 PKT · Sunday closed |
| Instagram | [instagram.com/flightone](https://www.instagram.com/flightone) |
| Meta title | Custom Tour Packages from Pakistan \| FlightOne Travel |
| Meta description | FlightOne designs custom tour packages from Pakistan for the Maldives, Turkey, Dubai and more. Get a full itinerary with honest pricing within 24 hours. |

### Voice
Direct Pakistani English; anti-generic packages; WhatsApp-first; transparent PKR pricing; honest about visa risk (no guarantees).

---

## Product model

- **Includes (claimed):** Flights, hotels, transfers, day-by-day plan, visa support  
- **Tiers:** 3★ / 4★ / 5★ quotes on the same route  
- **Segments:** Honeymoon, family, group/corporate (10+), solo  
- **Add-ons:** Travel e-SIM; standalone hotels; standalone visa help  
- **Stats shown on site:** 9 destinations · 24h turnaround · 3 comfort tiers  

### How it works
1. **Tell us about your trip** — destination, dates, travellers, hotel tier (≈2 minutes via WhatsApp/form).  
2. **We design your itinerary** — flights, hotels, activities, transfers; complete plan in 24 hours.  
3. **You travel with everything handled** — visa file, bookings, one WhatsApp contact end-to-end.

---

## Destinations (from prices, Jul 2026)

Prices are **from / per person, incl. airfare**. Destination detail pages linked but **404**.

| Destination | From (PKR) | Visa signal | Best for |
|---|---:|---|---|
| Maldives | 385,000 | Free visa on arrival | Honeymoons, beach rest |
| Sri Lanka | 265,000 | Free ETA (since May 2026) | Value, scenery, tea country |
| Dubai | 245,000 | Pre-approved e-visa | First international trip |
| Malaysia | 295,000 | Online eVisa | Families, budget variety |
| Thailand | 325,000 | Mandatory e-Visa | Beaches + city |
| Singapore | 350,000 | Authorised-agent visa | Families, city breaks |
| Turkey | 450,000 | e-Visa or sticker | Culture, honeymoons |
| Morocco | 385,000 | Embassy sticker | Culture, desert |
| Egypt (Nile Cruise) | 350,000 | Embassy visa | History, Nile cruising |

**Hero rotator (5 of 9):** Maldives, Sri Lanka, Dubai, Thailand, Turkey.

---

## Travel styles

| Tag | Offer | Pitch |
|---|---|---|
| Romantic | Honeymoon packages | Overwater villas, Cappadocia caves, private dinners on your dates |
| Family | Family holidays | Connecting rooms, kid-friendly resorts, workable flight times |
| Groups | Group & corporate | Retreats, incentives, friend groups — group airfare + one invoice |
| Add-on | e-SIM | Ready-to-activate QR before you fly |

---

## Differentiators (verbatim pillars)

1. **Your itinerary in 24 hours** — complete day-by-day with hotel names and final pricing.  
2. **Transparent pricing, always in writing** — approve the number you pay; no checkout surprises.  
3. **Three comfort tiers on every route** — compare 3★/4★/5★ on the same trip.  
4. **Visa support built in** — full file prep; honest about weak points before you spend.

**Primary value H1:** Custom Tour Packages from Pakistan, Designed Around You  

**Body (abridged):** FlightOne builds custom packages for travellers tired of pre-made options. Tell us destination, group size, comfort level — flights, hotels, transfers, day-by-day plan, visa support within 24 hours. Nothing templated; nothing priced to cover unsold inventory.

---

## Testimonials (live homepage)

| Name | When | Theme |
|---|---|---|
| Ahmed Raza | 2 weeks ago | Turkey — next-day itinerary, Cappadocia balloon pre-booked |
| Sana Khalid | 1 month ago | Maldives honeymoon — clear pricing, VOA smooth |
| Bilal Ahmed | 3 weeks ago | Dubai family — visa delay communicated; desert safari |
| Fatima Malik | 2 months ago | Thailand group of 12 — single invoice |
| Usman Tariq | 1 week ago | First abroad / Malaysia eVisa — calm visa coaching |

---

## FAQ (homepage accordion; `/faq/` 404)

Covered live: pricing model, free itinerary, destinations list, visa non-guarantee, deposits, visa refusal refunds, standalone hotel/visa, groups 10+, e-SIM, 24h quote SLA.

---

## Broken / missing routes (stakeholder risk)

| Linked URL | Status |
|---|---|
| `/destinations`, `/destinations/*` | 404 |
| `/honeymoon-packages`, `/family-holidays`, `/group-tours` | 404 |
| `/e-sim`, `/visa-assistance`, `/about` | 404 |
| `/contact-us`, `/faq/` | 404 |
| `/robots.txt`, `/sitemap.xml` | 404 |

**Working conversion path today:** WhatsApp. Contact-form CTAs are broken until `/contact-us` ships.

Schema `@id` on the homepage references `https://flightone.pk` (Organization / TravelAgency) — metadata only.

---

## Product seeding map (this repo)

| FlightOne content | Earth Odyssey surface | Status |
|---|---|---|
| Structured seed | `lib/content/flightone.ts` | Live |
| 9 destinations + PKR from-prices | `/` atlas + globe pins | Live |
| How it works | `/` `#how-it-works` | Live |
| Styles (honeymoon/family/group/e-SIM) | `/` `#styles` | Live |
| Testimonials | `/` `#stories` | Live |
| FAQ | `/` `#faq` | Live |
| Contact / WhatsApp | Header + `#contact` CTAs | Live |
| 24h / 9 / 3★ stats | Hero meta | Live |
| Ava greeting + brand | `/chat` + consultant prompt | Live |

**Demo path for stakeholders:** open `/` (scroll full story) → WhatsApp CTA → `/chat` with Ava.

Inner traveller boards (trips, vault, visa…) keep product chrome; stakeholder narrative lives on `/` until marketing sub-routes are rebuilt on the live site.

---

## Wayback caution

Older archives (e.g. 2025) showed a different brand layer (TravelPayouts, corporate logos, Umrah/USA-UK visas). **Do not seed that as current product** without stakeholder confirmation.

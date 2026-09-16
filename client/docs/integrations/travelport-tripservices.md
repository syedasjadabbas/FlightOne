# Travelport TripServices — Flights integration context

**Audience:** engineers implementing the Galileo / Travelport flight adapter (Module 03).  
**Researched:** 2026-08-01 · **Adapter code:** 2026-08-03 · Primary sources: [developer.travelport.com](https://developer.travelport.com/docs/getting-started).  
**Status:** Server adapter + guest-chat live path implemented. Pre-prod OAuth must succeed
with your trial credentials before live fares appear in `/chat`.

### Implementation map (this repo + server)

| Piece | Location |
|---|---|
| OAuth + Flights Search | `filght-one-server/modules/suppliers/travelport/` |
| Stays SearchComplete (v12) | `…/travelport/staysSearch.js` + `stays.js` |
| Galileo / hotel adapters | `galileo.adapter.js`, `ratehawk.adapter.js` (Travelport when configured) |
| Smoke tests | `npm run smoke:travelport` · `npm run smoke:travelport:stays` |
| Guest chat live flights/hotels | `liveFlights.ts`, `liveHotels.ts`, `orchestrator.ts` |
| Env (server, gitignored) | `TRAVELPORT_*`, `INTERNAL_API_KEY` |
| Env (Next, gitignored) | `INTERNAL_API_KEY`, `TRAVELPORT_LIVE_SEARCH` |

If OAuth returns `access_denied` / `Unauthorized`, re-copy credentials from the Travelport
email into server `.env` (screenshots often OCR-corrupt `0`/`O`, `N`/`n`, `I`/`l`).
Prove token + Search in Postman before blaming application code.

### Stays notes (as of 2026-08-03)

- Use **SearchComplete** `POST /12/hotel/search/searchcomplete` (not the 3-step v11 flow).
- **Request schema** (locked in `staysRequest.js` — migration snippets are incomplete):
  - `stayDetails.guests.adults` (integer) — not `numberOfAdults`
  - `stayDetails.rooms` (integer)
  - `propertyFilter.location.type: "cityIATACode"`
  - `propertyFilter.location.details.iataCode`
  - `propertyFilter.location.radius: { value, unit: "km"|"mi" }`
- **Currency:** TripServices returns local amounts (often AED) plus
  `hotelsResponse.currencyExchangeRates`. The API does **not** convert totals;
  our normalizer applies `conversionFactor` so offers are in `TRAVELPORT_CURRENCY`
  (default INR). Source currency + factor are kept on `details` for audit.
- Normalize from `hotelsResponse.propertyItems[].lowestPublicAvailableRate`.

---

## Verdict

FlightOne’s “Galileo GDS adapter” should target **Travelport TripServices Flights v11**
(REST/JSON), not a legacy cryptic/SOAP Universal API as the primary path.

For most customers, **GDS and NDC content in TripServices is sourced from Galileo (IATA
1G)**. The adapter facade can keep supplier code `GALILEO`; the HTTP client talks to
TripServices.

**First slice:** OAuth + Search → (optional AirPrice) → workbench Book → workbench Ticket.  
**Defer:** TripServices Stays (hotels stay on RateHawk for now) and Pay (FlightOne owns
payment gateway).

**Commercial blocker:** Travelport sales / trial provisioning (PCC, access group, currency,
carrier access) — not code.

---

## What TripServices is

Three product families on one platform:

| Family | Base path (v11) | FlightOne relevance |
|---|---|---|
| **Flights** | `/11/air/` | Primary — Module 03 flights |
| **Stays** | `/11/hotel/` or `/12/hotel/` | Later only if replacing/supplementing RateHawk |
| **Pay** | `/11/payment/` | Unlikely if FlightOne owns card capture |

Getting started: https://developer.travelport.com/docs/getting-started

Observed Flights OpenAPI version at research time: **11.35.0**.

---

## Environments (post Jan 2026 migration)

Old `oauth.*.travelport.com` / `api.travelport.com` endpoints were **deprecated 30 Jan 2026**.
Use `.travelport.net` only.

| Env | Auth | Flights API base |
|---|---|---|
| Pre-prod | `https://auth.pp.travelport.net/oauth/token` | `https://api.pp.travelport.net/11/air/` |
| Prod | `https://auth.travelport.net/oauth/token` | `https://api.travelport.net/11/air/` |

Example Search URL (prod):

`https://api.travelport.net/11/air/catalog/search/catalogproductofferings`

A few endpoints omit `/air` in the base path (Cancel Workbench Items, Document History/List,
Batch Void, some GDS Exchange APIs) — check each API reference.

---

## Authentication

Docs: https://developer.travelport.com/docs/getting-started/authentication

| Item | Detail |
|---|---|
| Protocol | OAuth 2.0; HTTPS/1.1; TLS ≥ 1.2 |
| Credentials | `username`, `password`, `client_id`, `client_secret` (from provisioning / trial) |
| Grant | Support docs specify `grant_type=password` — confirm exact body encoding in Postman DevKit |
| Token TTL | **24 hours** (86,400s) |
| Caching | **Required.** Cache and reuse. Certification **fails** if a token is minted per request. Prefer refresh ~every 23h. |
| Rate limit | 50 token requests / second / unique IP |
| MCN | One token per Master Customer Number covers all access groups/PCCs under that MCN |

**Access group** (sent on API calls) encodes PCC, location, **default currency**, NDC/GDS
carrier access, and printer linkages.

Trial users receive all four credential fields by email. New customers receive
`client_id` / `client_secret`, then create identities in MyTravelport Credential Access
Manager.

---

## Required Flights headers

Docs: https://developer.travelport.com/docs/flights/general/common-flights-api-headers

| Header | Role |
|---|---|
| `Authorization` | `Bearer {access_token}` |
| `Accept-Encoding` | Compression required (e.g. `gzip, deflate`) — **mandatory for production traffic** |
| `Cache-Control` | `no-cache` |
| `Accept` | `application/json` (Premium Flex stream: `application/stream+json`) |
| `Content-Type` | `application/json` when body present (documented exceptions: some post-commit / NDC cancel) |
| `XAUTH_TRAVELPORT_ACCESSGROUP` | Access group for the PCC |
| **or** `TVP-PCC-CORE` | `{PCC}_{GDS}` e.g. `79JP_1G` where supported; if both sent, access group wins |
| `Accept-Version` / `Content-Version` | API version (e.g. `11`, `11_1`) where required for the operation |
| `TraceId` | Optional custom correlation ID; echoed in response body |

Response headers include **`E2ETrackingId`** — store for Travelport support. Do not confuse
with OpenTelemetry TraceId.

**Doc conflict:** DevKits table sometimes labels version header `Accept-Version-Type`;
Common Headers doc says `Accept-Version`. Prefer Common Headers + live Postman collection.

---

## Domain concepts (Flights)

From the [Flights general guide](https://developer.travelport.com/docs/flights/guides/flights-general-guide)
and [Search guide](https://developer.travelport.com/docs/flights/guides/flights-search-guide):

| Term | Meaning |
|---|---|
| Itinerary / journey | Whole trip |
| Leg (O&D) | One origin→destination; maps to `CatalogProductOffering` |
| Segment | Single flight on a leg |
| Product | Flight(s) on a leg + service level (cabin / fare codes) |
| ProductBrandOffering | Product + price + terms (an *offer* at search time) |
| Branded fare / upsell | Bundled attributes; Search returns ≤4 upsells; Flight Specific ≤99 |
| PTC | Passenger type; common: ADT, CNN/CHD, INF (see Conflicts) |
| Workbench | Session container for booking/ticketing steps |
| Locator | Reservation confirmation; GDS: one Travelport locator; NDC: carrier + Travelport passive |
| contentSourceList | `GDS`, `NDC`, or both; **default = GDS only** |

**Polymorphism:** OpenAPI 3 discriminator (`objectType` in schema examples; live JSON often
uses `@type`). Code generators frequently mishandle this — see
[Best practice: Polymorphism](https://developer.travelport.com/docs/getting-started/best-practice-polymorphism).
Normalize to FlightOne’s internal offer model; do not leak raw polymorphic graphs to clients.

---

## End-to-end workflow

```
OAuth token (cached 24h)
        │
        ▼
1. SEARCH  POST …/catalog/search/catalogproductofferings
   optional: Next Leg …/buildnext · Flight Specific …/buildoptions
   optional: Air Availability …/search/airAvailability (schedule only, no price, GDS)
        │
        ▼
2. AIRPRICE (optional many carriers; required some NDC / LCC)
   POST …/price/offers/buildfromcatalogproductofferings  (reference)
   or   …/price/offers/buildfromproducts                 (full)
        │
        ▼
3. BOOK (new workbench ≤ 30 min)
   POST …/book/session/reservationworkbench
   POST …/book/airoffer/reservationworkbench/{id}/offers/buildfromcatalogofferings
   POST …/book/traveler/reservationworkbench/{id}/travelers
   POST …/book/reservation/reservations/{workbenchID}
   → held booking + locator
        │
        ▼
4. TICKET (post-commit workbench)
   POST …/book/session/reservationworkbench/buildfromlocator?Locator={code}
   POST …/payment/reservationworkbench/{id}/formofpayment
   POST …/paymentoffer/reservationworkbench/{id}/payments
   POST …/book/reservation/reservations/{workbenchID}
   → ticket numbers
```

Full endpoint list:
https://developer.travelport.com/docs/flights/general/flights-api-endpoints

### Timing constraints (fact)

| Window | Duration |
|---|---|
| Search cache for reference payloads | **12 min GDS** / **34 min NDC** |
| Workbench must commit | **30 minutes** |
| Held booking ticket-by | Often ~24h; see commit response `ExpiryDate` / `PaymentTimeLimit` |

### Search settings that matter for FlightOne

- Prefer **journey-based** Search for MVP (`SearchRepresentation` defaults to Journey).
- If later steps use **reference payloads** (AirPrice / Add Offer by ID), set
  `offersPerPage` ≥ 1 on journey-based Search so results are cached.
- Start with **GDS only** (omit `contentSourceList` or send `GDS`) until NDC is provisioned.
- Default currency comes from the **PCC**; override via pricing modifiers if needed.
- Multi-city: up to **6** O&D GDS / **3** NDC.

### Booking vs ticketing

- Book commit **without** payment → held reservation (maps to Module 03 `Reserved`).
- Ticket commit **with** FOP + Payment in workbench → issued tickets (`Ticketed`).
- Instant Pay (book+ticket same workbench) is **NDC only**.
- Ticketless carriers complete at book commit (no separate ticket step).

**Idempotency** of ticket retry is a **FlightOne** concern (Module 03 checklist). TripServices
docs emphasize workbench TTL, not client idempotency keys.

---

## FlightOne adapter mapping

Keep the Supplier Integration Layer. Orchestration never imports TripServices types.

| FlightOne | TripServices |
|---|---|
| `SupplierAdapter.searchFlights` | Search (+ normalize offers) |
| Stale-quote / re-price | AirPrice before reserve |
| `Quoted → Reserved` | New workbench → Add offer/travelers → Commit → locator |
| `Reserved → Ticketed` | Post-commit workbench → FOP → Payment → Commit |
| Supplier code `GALILEO` | Facade name; HTTP → TripServices |
| Module 05 margin | Applied on server after supplier net; never invent fares |
| Hotels | RateHawk (not Stays) unless product changes |
| Payment capture | FlightOne gateway (not TripServices Pay) unless contract requires it |

### Recommended build order

1. Sales / trial credentials → PCC, access group, currency confirmed.
2. Import Flights DevKit Postman; prove OAuth + Search in pre-prod.
3. Token cache service (24h, one per MCN).
4. Search adapter → normalize to internal `SupplierOffer`; persist offer refs + TTL + tracking IDs.
5. AirPrice + Add Offer reference path.
6. Book workbench → locator; wire state machine.
7. Ticket workbench + FlightOne idempotency keys.
8. Certification package (see below).
9. Later: NDC, seats/ancillaries/EMDs, void/exchange/refund, queues.

---

## Errors & observability

Docs: https://developer.travelport.com/docs/flights/general/error-messaging

- Errors/warnings live under `Result/Error` and `Result/Warning` (`StatusCode`, `Message`,
  `SourceID`, `SourceCode`, category).
- SourceCode bands (high level): 1 impairment, 1000 validation, 2000 system, 3000 AirPrice,
  4000 reservation, 8000 ancillaries, 9000 search, …
- Communication errors often: StatusCode 200, Message `COMMUNICATION ERROR`, SourceCode 2599.
- Always log request `TraceId` (if sent) and response `E2ETrackingId` for support cases.

---

## Certification

Docs: https://developer.travelport.com/docs/getting-started/ready-to-certify

- ≥ **15 days** notice before production.
- Sample request/response logs from **your** system for every API you will use in prod.
- Flights samples must include: ADT + child + infant (ages for child/infant), round-trip
  **with connection**, and consistent private/net/account fares if those are in scope.
- Headers must show compression + correct version fields.
- Written documentation of token refresh cadence (~once / 23h).
- Raise MyTravelport case: Developer Product Services → Certification → TripServices API
  Microservices. Production credentials issued after approval.
- Access is limited to **contracted** APIs.

DevKits / Postman: https://developer.travelport.com/resources/devkits-and-downloads  
Using DevKits: https://developer.travelport.com/resources/using-the-devkits

---

## Doc conflicts to resolve in pre-prod

| Topic | Conflict | Action |
|---|---|---|
| Child PTC | Certification checklist uses **CHD**; general guide common list uses **CNN** | Confirm in Search API reference / your PCC |
| Version header name | `Accept-Version` vs DevKit `Accept-Version-Type` | Prefer Common Headers + Postman |
| Trace / transaction ID scope | Some pages: unique per call; others: reuse across a workflow | Log both; verify in pre-prod |
| OAuth body | Developer auth page lists four credentials; support page also lists `grant_type=password` | Copy Postman OAuth request exactly |
| `@type` vs `objectType` | Polymorphism examples vs live Air JSON | Accept both when unmarshalling; normalize internally |

---

## Open questions (product / commercial)

Track answers in [STAKEHOLDER_QUESTIONS.md](../STAKEHOLDER_QUESTIONS.md) § Module 03.

- Does FlightOne already have a Travelport agency agreement / PCC / MCN?
- Default PCC currency — PKR available, or USD + Module 05 FX?
- Pakistan leisure content: PIA, Gulf, South/SE Asia LCC coverage for a Lahore POS?
- Private / net / consolidator fares and account codes needed for packages?
- Phase 1: GDS only, or NDC carriers required at launch?
- Ancillaries (bags/seats) in Phase 1?

---

## Primary URLs

| Topic | URL |
|---|---|
| Getting started | https://developer.travelport.com/docs/getting-started |
| Authentication | https://developer.travelport.com/docs/getting-started/authentication |
| Ready to certify | https://developer.travelport.com/docs/getting-started/ready-to-certify |
| Polymorphism | https://developer.travelport.com/docs/getting-started/best-practice-polymorphism |
| Flights general | https://developer.travelport.com/docs/flights/guides/flights-general-guide |
| Search guide | https://developer.travelport.com/docs/flights/guides/flights-search-guide |
| Booking guide | https://developer.travelport.com/docs/flights/guides/booking-and-reservations/flights-booking-guide |
| Ticketing guide | https://developer.travelport.com/docs/flights/guides/ticketing-guide |
| Endpoints | https://developer.travelport.com/docs/flights/general/flights-api-endpoints |
| Headers | https://developer.travelport.com/docs/flights/general/common-flights-api-headers |
| Trace IDs | https://developer.travelport.com/docs/flights/general/transaction-and-trace-ids |
| Errors | https://developer.travelport.com/docs/flights/general/error-messaging |
| DevKits | https://developer.travelport.com/resources/devkits-and-downloads |
| Stays (later) | https://developer.travelport.com/docs/stays/guides/stays-general-guide |
| Pay (later) | https://developer.travelport.com/docs/pay/guides/pay-general-guide |

---

*If this note conflicts with live TripServices docs, the vendor docs win. If it conflicts
with Module 03 product scope, Module 03 + stakeholder answers win.*

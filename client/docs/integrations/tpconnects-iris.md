# TPConnects Iris — Flights aggregator integration research

**Audience:** engineers / product evaluating or implementing a TPConnects Iris
supplier adapter (Module 03).  
**Researched:** 2026-08-11 · **Live hosts checked:** 2026-08-17 · **Adapter code:** none yet.  
**Status:** Research + live host map. Portal login is **not** Express API access.
OpenAPI/Swagger exists on TPC hosts (see below). `api-key` / `secret-key` /
`agent-code` are still provisioned per agency.

Primary sources: live TPC hosts (2026-08-17), [tpconnects.com](https://tpconnects.com/),
Iris product pages, TPConnects press / newsletters (Apr–Jun 2026). Secondary: trade
coverage of Iris Express API (INTLBM, AltexSoft, Business Travel News).

---

## Verdict

**TPConnects Iris** is a **multi-source air content aggregator for travel sellers**
(NDC + LCC + GDS behind one normalized surface). For FlightOne it is a candidate
**second / alternate flights supplier** — especially for NDC-rich and LCC content —
not a drop-in replacement for the live Travelport TripServices path until commercial
access and a private API kit exist.

| Path | When it fits FlightOne |
|---|---|
| **Iris Express API** (recommended first slice) | Lightweight REST **shop → price → book** (+ optional seats/ancillaries). Best match for Ava search latency and an adapter like `galileo.adapter.js`. |
| **Iris Aggregator API** (full NDC-shaped) | Based on IATA NDC schemas **18.2 / 21.3**; full order servicing (exchange, refund, void, disruption). Heavier payloads; use when post-booking depth matters. |
| **Iris Portal** | Browser / white-label ops UI — useful for agents (Module 15 / 13), **not** the chat booking engine. |
| **Iris MCP layer** | Vendor-marketed “AI-ready” protocol over the same aggregated content. Interesting for Ava-style agents **after** Express/API is proven; do not treat marketing MCP as a substitute for a typed HTTP adapter + server money authority. |
| **Iris Pricing Engine** | Supplier-side markups / sub-agent tiers. **FlightOne Module 05 remains the customer-facing price authority** — never double-markup blindly; either map supplier net → Module 05 or freeze Iris markups to zero and own margin in-house. |

**Commercial blocker (same class as Travelport):** sales demo + contract + sandbox /
airline entitlements — not code. Contact: `sales@tpconnects.com` · demo:
[iris-travel-seller-demo](https://tpconnects.com/iris-travel-seller-demo-extnl/).

**Do not** invent fares. Prove a priced search with real `api-key` / `secret-key`
in Swagger or curl before wiring `/chat`.

---

## Portal login vs Express API (2026-08-17)

[aggregator.tpconnects.online](https://aggregator.tpconnects.online/) is the **Iris
Portal** (Angular agent UI: shop flights, orders, pricing engine, credentials).
The login form (`POST /api/sign-in`, cookie + CSRF) is for humans in a browser.
**Those username/password credentials cannot be dropped into Express/NDC API
headers.** Do not call the portal’s `/api/flights/*` routes from FlightOne —
they are a CSRF-protected BFF for the SPA.

| Host | What it is | Auth |
|---|---|---|
| `https://aggregator.tpconnects.online` | Iris Portal UI + Node BFF | Username/password → cookie `user_sid` + CSRF. Login title: “TPConnects \| IRIS”. |
| `https://api.tpconnects.online` | Combined NDC JSON gateway (IATA AirShopping / OfferPrice / OrderCreate). [Swagger UI](https://api.tpconnects.online/swagger-ui/index.html) · [OpenAPI](https://api.tpconnects.online/v3/api-docs) | Headers: `api-key`, `secret-key`, `agent-code` |
| `https://api.aggregator.tpconnects.online` | Aggregator Java API (portal backend + same NDC REST family). OpenAPI at `/v3/api-docs` | `Authorization: Bearer <JWT>` **or** `api-key` + `secret-key` (+ `agent-code` on air calls). Unauthenticated calls return: *please provide a valid token or api-key and secret-key in the request header* |

### What to do with portal login

You **cannot mint Express/NDC API keys from login**. The portal has no “API Keys”
or “Developer” screen (the SPA never even contains `secret-key` UI). **Manage
Credentials** (`/dmt/management/credentials-manager`) is airline/office-ID
admin — and only if your role’s menu includes DMT. An agent who can only log in
and search flights will not see API secrets there.

**What login is for:** shop/book in the UI, prove the agency is entitled.

**How to get `api-key` / `secret-key` / `agent-code`:** email the TPC SE who
created the portal user (or `sales@tpconnects.com`) and ask them to provision
**Iris Express API** (or Combined API Gateway) credentials for this agency.
Portal username/password are a different product.

Ready-to-send ask:

> We have Iris Portal access at aggregator.tpconnects.online (username: &lt;portal
> user&gt;). Please provision API credentials for Express API (preferred) or the
> Combined NDC gateway at api.tpconnects.online:
> - api-key, secret-key, agent-code
> - sandbox/prod base URL
> - Postman or OpenAPI for shop → price → book
> First test route: LHE–DXB (one-way). We will not use portal cookies against
> /api/flights/*.

After keys arrive, put them in **server** `.env` only.

Optional after login (does **not** replace keys): DevTools → Application →
Cookies / Local Storage → JWT `user.agent_code`. Send that code in the TPC
email so they map the right agency. Do not use the portal JWT as production API
auth.

### Express vs full NDC on these hosts

| Surface | Endpoints (observed) | Payload |
|---|---|---|
| **NDC REST (live)** | `POST https://api.tpconnects.online/rest/airShop` → `/rest/offerPrice` → `/rest/orderCreate` (+ `/rest/seatAvailability`, `/rest/serviceList`, `/rest/orderRetrieve`, `/rest/orderChange`, `/rest/orderCancel`) | IATA JSON roots e.g. `IATA_AirShoppingRQ`. Empty `{}` is rejected with a parse error naming that root — the path is real. Swagger lists the same ops under `/swagger/*` (those `/swagger/` paths 400 without a schema-shaped body). |
| **Aggregator NDC REST** | `POST https://api.aggregator.tpconnects.online/rest/airShop` (same family) | Same IATA schemas in that host’s OpenAPI. |
| **Portal BFF (do not use from server)** | Same-origin `POST /api/flights/airShopping` → `flightPrice` → `orderCreate` (also kebab-case `air-shopping` / `flight-price` / `order-create`) | SPA-only. CSRF `ForbiddenError` without a portal session. |
| **Express API (lightweight)** | **Not** a public hostname we could resolve (`express*.tpconnects.online` NXDOMAIN). Marketing: REST **shop → price → book**. Portal JS uses camelCase `airShopping` / `flightPrice` / `orderCreate` against the Java endpoint from `/api/get-env` — treat that as the Express-shaped surface **once TPC confirms the base URL**. | Smaller than IATA NDC; confirm with TPC Postman. |

**FlightOne first slice:** once keys exist, hit **NDC REST**
`api.tpconnects.online/rest/airShop` from Swagger “Try it out” (or curl) with
headers below. If TPC later hands an Express base URL, swap the adapter to that
shop/price/book trio — keep the same internal offer model.

### Auth headers (NDC / aggregator API)

```http
api-key:     <from TPC or Credentials Manager>
secret-key:  <from TPC or Credentials Manager>
agent-code:  <agency agent_code>
Content-Type: application/json
```

Aggregator API also accepts `Authorization: Bearer <JWT>` (portal session token).
**Do not** scrape the portal JWT into production FlightOne — mint/use the
long-lived `api-key` + `secret-key` pair.

### Smoke: prove the gateway (no secrets in git)

```bash
# Expect IATA parse error (proves path + JSON stack), not 404
curl -sS -X POST 'https://api.tpconnects.online/rest/airShop' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Then retry with real headers + an `IATA_AirShoppingRQ` body from Swagger
schemas (`IATAAirShoppingRQ`). A successful shop returns `IATA_AirShoppingRS`
offers — **only then** copy the pattern into
`filght-one-server/modules/suppliers/tpconnects/`.

### What not to do

- Paste portal username/password into API headers or into this repo.
- Drive bookings through `aggregator.tpconnects.online/api/flights/*` (CSRF,
  cookies, not an integration contract).
- Show Iris prices in Ava until Module 05 has normalized **supplier-net** vs
  already-marked amounts.

---


## What TPConnects is

| Item | Detail | Source type |
|---|---|---|
| Company | TPConnects Technologies — IATA-certified airline retailing / NDC / aggregation vendor; HQ messaging centered on **Dubai, UAE** | Fact (vendor About / press) |
| Scale claim | “Over 2 billion orders” / “60+ customers” | Fact as published by vendor; not independently audited here |
| Twin portfolios | **Astra** — for airlines (NDC gateway, B2B portal, MCP on airline side). **Iris** — for travel sellers (aggregation) | Fact |
| FlightOne relevance | **Iris only** (we are a seller / OTA-style AI-TOS). Astra is airline-side; ignore for adapter work unless TPC routes something odd through it | Inference |

---

## Iris product surface (seller-facing)

Three deployables on one content backbone:

| Product | Role | FlightOne use |
|---|---|---|
| **Iris Portal** | Shop / sell / service UI; white-label; agency hierarchy; unlimited users (as marketed) | Ops fallback; sub-agent network later |
| **Iris API** | Normalized multi-source API into your own front end | Server adapter target |
| **Iris Pricing Engine** | Markups, promotions, sub-agent tiers, margin caps, reporting | Optional; conflict-check vs Module 05 |

Marketing workflow framing: **Shop → Order → Pay → Service** (Apr 2026 content
expansion press).

Content footprint **as of vendor Apr 2026 claims**:

- **60+** NDC / LCC airlines (plus ongoing adds).
- **4 GDS:** Amadeus, Sabre, Travelport, Abacus — unified with NDC/LCC in one workflow.
- Example recent NDC/FSC names cited: Cathay Pacific, Turkish Airlines, Riyadh Air,
  ITA Airways.
- Example LCC via **Kyte** partnership: easyJet, Volotea, Transavia, Wizz Air.

**Capability matrix:** TPC links a “Supplier Capabilities” page from nav / Iris API
copy. Fetch of that page returned an error page during this research (2026-08-11) —
treat the live roster as **must re-check at demo time**, not from memory.

---

## Integration options (detail)

### 1. Iris Aggregator API (standard)

**Audience (vendor):** OTAs, TMCs, consolidators, corporate booking tools with their
own platform and IT team.

**Public facts:**

- Standardized content from NDC, GDS, and LCC via one API.
- Schema basis: **IATA NDC 18.2 and 21.3**.
- Lifecycle (marketing-listed): order create (book & hold, instant ticketing); order
  change (exchange, cancel, refund, reissue, void); ancillaries on new/existing
  orders; disruption / involuntary change handling; email notifications for issues
  and involuntary changes.
- Merch: extra baggage; free/paid seats; meals, upgrades, extras.
- Shopping emphasis: compact/lightweight shopping responses, multi-IATA shopping,
  split ticketing called out as “next generation” capability.
- Support claim: 24/7 technical / 17/7 customer support.

**Known live (2026-08-17):** see [Portal login vs Express API](#portal-login-vs-express-api-2026-08-17)
for hosts, headers, and `/rest/airShop` → `/rest/offerPrice` → `/rest/orderCreate`.

**Still unknown:** Express public base URL / OpenAPI, idempotency, offer TTL, rate
limits, webhook vs poll, settlement / BSP / form-of-payment per market.

### 2. Iris Express API (lightweight REST)

Announced ~mid-2026 as part of Iris; coverage (INTLBM 2026-06-17, AltexSoft,
BTN) aligns with vendor messaging:

- Proprietary **lightweight REST** alternative to full NDC schema weight.
- Smaller response payloads vs traditional NDC.
- Workflow: **shop → price → book**, with **optional** seat and service selection.
- Aimed at faster integrate / respond cycles for web, mobile, and “next-gen”
  interfaces.
- Available to **TPConnects travel seller customers** (not a public open registry).

**Inference for FlightOne:** Express is the pragmatic first integration surface if
commercial access is granted — mirrors the Travelport “Search → AirPrice → Book”
mental model already documented in
[travelport-tripservices.md](./travelport-tripservices.md), with less NDC XML/JSON
surface area.

### 3. Iris MCP layer (AI protocol)

Press (7 Apr 2026): MCP sit on top of Iris aggregation; machine-readable exposure of
normalized airline content; claims of instant discovery when new carriers/capabilities
appear; aimed at chatbots, agents, autonomous shopping.

**FlightOne stance (product invariant):**

1. Ava may **propose**; **server owns money and truth** (`PRODUCT.md`).
2. Prefer a **deterministic typed adapter** (Express or Aggregator API) inside
   `filght-one-server/modules/suppliers/` that returns the same internal offer model
   as Galileo / Travelport.
3. Evaluate MCP only as an **optional discovery / tool channel** after HTTP booking
   is certified — and never let an LLM invent prices from MCP text.

---

## Conceptual end-to-end workflow (vendor-described)

Public materials do **not** publish path-level sequences. The working model to
validate in sandbox:

```
Provision credentials + airline / GDS entitlements
        │
        ▼
1. SHOP     Search offers across NDC / LCC / GDS (normalized)
            Express: lightweight shop payload
            Full API: NDC-schema shopping responses
        │
        ▼
2. PRICE    Revalidate / price selected offer (Express: explicit price step)
            Confirm currency, passenger mix, fare rules, TTL
        │
        ▼
3. ANCILLARY (optional)  Seats, bags, meals, upgrades
        │
        ▼
4. ORDER    Book & hold  OR  instant ticket
            Capture locator / order id / ticket numbers
        │
        ▼
5. PAY      Form of payment (model TBD — BSP, agency credit, customer card…)
            FlightOne may keep card capture on own gateway (same stance as TripServices Pay)
        │
        ▼
6. SERVICE  Exchange, refund, reissue, void, involuntary change, PNR import
            Prefer Iris Portal for ops MVP; API for Module 14 later
```

Align state transitions to Module 03:
`Quoted → Reserved → Ticketed/Confirmed → …` after normalizing Iris order states.

---

## Comparison: Iris vs Travelport TripServices (FlightOne today)

| Dimension | Travelport TripServices (live path) | TPConnects Iris (candidate) |
|---|---|---|
| Role | GDS platform API; our facade is Galileo / 1G | Aggregator over NDC + LCC + **multiple** GDS |
| Public docs | Strong (developer.travelport.com, OpenAPI) | Marketing + brochure; **private** tech kit |
| Auth known? | Yes — OAuth on `.travelport.net` | Yes — `api-key` + `secret-key` + `agent-code` (and optional Bearer JWT on aggregator API). Express kit still from TPC. |
| Content | GDS (+ NDC when entitled on same stack) | NDC/LCC depth is the selling point; GDS included |
| Fit for Ava | Search live today | Potential richer NDC/LCC + single merge surface |
| Overlap risk | Already our GAL source | Iris may also surface Travelport — **dedupe** offers by airline/flight/fare keys if both adapters run |
| Hotels | Stays SearchComplete separate | **Air-focused** in public Iris materials; do not assume hotels |
| Pricing | Our Module 05 | Their Pricing Engine + our Module 05 — pick one owner |

**Inference:** If commercial terms and Pakistan / Middle East / Asia carrier coverage
beat Travelport alone for FlightOne’s Destinations set (DXB, IST, MLE, BKK, etc.),
Iris Express is a strong **complement**. Running both without merge/dedupe will confuse
ranking and Ava.

---

## FlightOne adapter design notes (when commercial access exists)

Mirror existing supplier patterns — do **not** call Iris from the Next app or from
the LLM.

| Piece | Intended location |
|---|---|
| HTTP client + auth | `filght-one-server/modules/suppliers/tpconnects/` (new) |
| Adapter facade | e.g. `tpconnects.adapter.js` implementing same search/book interface as `galileo.adapter.js` |
| Routes | Existing `POST /suppliers/search` (and future book/revalidate) — route by supplier code |
| Normalization | Map to internal offer model used by pricing + recommendation (same as Travelport) |
| Env (gitignored) | `TPCONNECTS_*` — base URL, client credentials, agency/seller id, currency — exact names TBD from vendor kit |
| Feature flag | e.g. `TPCONNECTS_LIVE_SEARCH` paralleling `TRAVELPORT_LIVE_SEARCH` |
| Smoke | `npm run smoke:tpconnects` once credentials exist |

**Hard rules:**

- Reject malformed shop/price responses; never coerce missing totals into guessed PKR.
- Revalidate before reserve and again before payment (Module 03).
- Circuit-break Iris independently of Travelport so one down supplier degrades search,
  not the whole chat.
- Log correlation ids from TPC responses for support; never log full PII / card data.

---

## Pricing & commercial model

| Topic | What’s known | What’s unknown |
|---|---|---|
| Iris Pricing Engine | Markups on flights/ancillaries; sub-agent tiers; overrides; margin caps; reporting | Whether API returns supplier-net, already-marked, or both |
| FlightOne Module 05 | Markup → `customerPrice`, honesty flags for live vs estimated | How to label Iris vs Travelport in chat |
| Incentives / airline deals | Aggregators can still carry negotiated / NDC incentive fares (TPC + AltexSoft explainer) | Pakistan BSP/ARC, consolidator vs direct IATA stack for FlightOne |
| Fees | Not published | Connectivity fee, booking fee, minimum commit |

**Recommendation:** In demo, demand (1) sample shop JSON with net vs sell fields,
(2) currency / FX rules for PKR presentation, (3) whether FlightOne must disable Iris
markups.

---

## AI-adjacent vendor story (context only)

- **Trip Captain** — TPC’s own conversational assistant (Amazon Bedrock), rolled toward
  Astra/Iris; H2 2025 initial features mentioned in older TPC AI materials. Competitive
  context for Ava, not an integration dependency.
- **Cumbaya** — press headline that TPC powers an external AI booking platform for
  agencies (related-news link from Iris MCP post). Treat as proof that TPC already sells
  into AI booking stacks; details not verified in this pass (landing URL 404’d).
- **Iris MCP** — see Integration options §3.

---

## Open questions (must get from TPC sales / SE)

1. Sandbox base URLs, auth scheme, Postman/OpenAPI, and certification checklist.
2. Exact Express vs Aggregator API feature parity (servicing, split ticket, multi-city).
3. Offer / price TTL and whether price step is mandatory before book.
4. Forms of payment and who settles (agency cash, BSP, merchant of record).
5. Pakistan / UAE / GCC GDS PCC requirements and which GDS is provisioned for us.
6. Carrier list + maturity for routes from **LHE / KHI / ISB** to FlightOne destinations.
7. Webhooks for involuntary schedule change vs polling.
8. Rate limits, SLA, and support escalation for live chat search latency.
9. Contract: can we run Iris **alongside** Travelport without exclusivity?
10. MCP: real tool schemas and auth, or marketing-only today?

---

## Unknown / could not verify

- **Express API** public hostname and OpenAPI — not on `api.tpconnects.online`
  Swagger; `express*.tpconnects.online` did not resolve (2026-08-17).
- Sample **successful** shop/book payloads (need keys). Empty-body error shapes
  are known.
- Whether Credentials Manager stores the same `api-key`/`secret-key` used by
  `api.tpconnects.online`, or only airline-office IDs — confirm after login.
- Supplier Capabilities **matrix HTML** — page error during 2026-08-11 research.
- Cumbaya partnership **detail page** — linked from news; direct fetch failed.
- Whether “Model Context Protocol” here is the same open MCP ecosystem used by Cursor
  / Anthropic tooling, or a TPC-branded parallel — vendor uses the same name; protocol
  compatibility is **unverified**.
- Independent validation of “2 billion orders” / customer counts.

---

## Recommended next steps

1. **With portal login:** shop LHE→DXB in the UI, then copy `api-key` /
   `secret-key` / `agent-code` from Credentials Manager — or ask TPC for the
   Express Postman if keys are missing.
2. **Spike:** Swagger Try-it-out on `POST /rest/airShop` with those headers.
   No chat wire-up until a priced offer round-trips.
3. **Product:** Decide complement vs replace Travelport for Phase 1 flights; document
   merge/dedupe if dual-source.
4. **Pricing:** Align Iris Pricing Engine vs Module 05 ownership before any live fare
   in `/chat`.
5. **Defer:** Iris Portal white-label, MCP, and full servicing API until search/book
   honesty path is certified.

---

## Sources

| Source | URL | Used for |
|---|---|---|
| Iris overview | https://tpconnects.com/iris-travel-seller-solutions/ | Product trilogy, content claims |
| Iris API | https://tpconnects.com/iris-travel-seller-solutions/iris-api/ | Schema versions, lifecycle, ancillaries |
| Iris Pricing Engine | https://tpconnects.com/iris-travel-seller-solutions/iris-pricing-engine/ | Markup / tier features |
| Content expansion press (Apr 2026) | https://tpconnects.com/resources/all-airline-integrations-iris-platform/ | 60+ airlines, 4 GDS, Kyte LCCs, sales@ |
| Iris MCP press (Apr 2026) | https://tpconnects.com/news/iris-mcp-layer-ai-airline-distribution/ | MCP positioning, Iris capability bullets |
| TPC Insider (Apr 2026) | https://tpconnects.com/news/newsletter-astra-iris-april-2026/ | MCP + airline expansion narrative |
| NDC normalization blog | https://tpconnects.com/resources/ndc-api-normalization/ | Normalization rationale |
| How to integrate airline content (Sep 2024, w/ AltexSoft) | https://tpconnects.com/resources/how-to-integrate-airline-content/ | Channel tradeoffs, servicing emphasis |
| Demo CTA | https://tpconnects.com/iris-travel-seller-demo-extnl/ | Commercial entry |
| Express API coverage | https://intlbm.com/2026/06/17/tpconnects-launches-express-api/ (+ AltexSoft / BTN) | shop-price-book, lightweight REST |
| Iris Portal (live) | https://aggregator.tpconnects.online/login | Agent UI; not the API |
| Combined NDC Swagger | https://api.tpconnects.online/swagger-ui/index.html | IATA REST Try-it-out |
| Combined NDC OpenAPI | https://api.tpconnects.online/v3/api-docs | Schemas + required headers |
| Aggregator Java API OpenAPI | https://api.aggregator.tpconnects.online/v3/api-docs | Bearer or api-key/secret-key |
| FlightOne Travelport baseline | [travelport-tripservices.md](./travelport-tripservices.md) | Comparison / adapter pattern |
| Module 03 | [03-ai-booking-engine.md](../modules/03-ai-booking-engine.md) | Booking state machine invariants |

---

*Internal research. Not affiliated with TPConnects. Facts decay — re-check supplier
capabilities and API kit after any commercial kickoff.*

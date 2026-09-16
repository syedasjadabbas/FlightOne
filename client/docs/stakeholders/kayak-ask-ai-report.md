# KAYAK Ask AI — End-to-end product & flow report

**Audience:** FlightOne product / engineering evaluating conversational travel search patterns.  
**Researched:** 2026-08-28 · **Primary sources:** [kayak.com/news](https://www.kayak.com/news/), [kayak.com/c/help/search](https://www.kayak.com/c/help/search/), PR Newswire, Skift, CX Today, Travel AI Playbook.  
**Status:** Competitive / reference research. Facts labeled; inference marked.

---

## Executive summary

KAYAK’s AI stack is **metasearch-first, not agentic booking-in-chat**. The flagship experience (**Ask AI**, Apr 2026) pairs a **conversational panel** with a **live, traditional results page** on the same screen. OpenAI **ChatGPT** parses natural language; **KAYAK’s own search platform** returns live inventory from **hundreds to 400+ travel providers**. Users **cannot pay inside chat** — they hand off via **View Deal** to standard KAYAK checkout or a partner site.

KAYAK’s accuracy strategy is structural: **never let the LLM be the only source of truth for price**. Live inventory, visible full result sets, Smart Filters, and traditional sort/filter controls sit beside the chat. Advisory text (weather, destination tips) is weaker and explicitly disclaimed.

**Design thesis (Keller, CPO):** *“The right model is not chat instead of search, but chat working alongside search.”* — [CX Today, Jul 2026](https://www.cxtoday.com/customer-engagement-journey-orchestration/kayak-ask-ai-conversational-travel-planning/)

---

## Product lineup (what “KAYAK AI” actually is)

KAYAK ships several related products; names are easy to confuse.

| Product | When | Status (Aug 2026) | Role |
|---|---|---|---|
| **ChatGPT plugin** | Mar 2023 | **Discontinued** (Skift, 2025) | ChatGPT called KAYAK; user clicked out to kayak.com to book |
| **Ask KAYAK** | Mar 2024 | Active on **classic results pages** | NL filter box: “Where to Go” + “Filter your Search” on existing SERP |
| **KAYAK PriceCheck** | Mar 2024 | Active (mobile) | Screenshot OCR → fare match; not conversational |
| **KAYAK.ai** | Apr 2025 | Test lab at [kayak.ai](https://kayak.ai/) | Chat-first sandbox; features “graduate” to kayak.com |
| **Microsoft Copilot Actions** | Apr 2025 | Active external channel | “Copilot, go to KAYAK…” triggers metasearch |
| **AI Mode** | Oct 2025 | Evolved into Ask AI | Homepage NL search; ChatGPT + KAYAK data |
| **Ask AI** | Apr–May 2026 | **Current flagship** | Split-pane: chat + live updating results |
| **World Cup Trends Dashboard** | Apr 2026 | Active | Macro demand/pricing viz; complements Ask AI |
| **Smart Filters** | 2024+ | Cross-cutting | NL → filter pills on Flights / Stays / Cars |

**Inference:** “Ask AI” is the consumer-facing name for the split-pane experience; “AI Mode” was the conversational entry that lacked side-by-side results until Ask AI merged chat + SERP.

---

## Architecture: how results are fetched

```
User types NL query (Ask AI / AI Mode)
        │
        ▼
ChatGPT (OpenAI) — intent parsing, dialogue, some advisory prose
        │
        ▼
KAYAK search platform — structured metasearch queries
        │
        ▼
Hundreds–400+ travel providers (airlines, OTAs, hotels, car cos.)
        │
        ▼
Live results → chat cards + parallel results panel (Ask AI)
```

**Facts (official help):**
- Combines **KAYAK travel data + ChatGPT** for contextual responses.
- **Real-time pricing** from hundreds of providers — “not cached information.”
- KAYAK is a **search engine**, not inventory owner; booking is always with a **partner**.

**Sources:** [Search & discovery help](https://www.kayak.com/c/help/search/), [AI Mode press](https://www.kayak.com/news/ai-mode/), [KAYAK.ai launch PR](https://www.prnewswire.co.uk/news-releases/kayak-launches-kayakai-to-pilot-ai-first-features-for-tech-savvy-travellers-302442416.html)

**Unverified:** Direct consumer GDS/NDC access (KAYAK for Business mentions GDS for corporate only).

**Discontinued channel:** 2023 ChatGPT plugin used historical KAYAK data + links out; Skift reports it is no longer active.

---

## Full user journey: query → booking confirmation

### Phase 0 — Entry

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **0.1** | Open Ask AI | Loads split-pane UI | Entry: [kayak.com/ai](https://www.kayak.com/ai) or homepage | Also [kayak.ai](https://kayak.ai/) for experimental features |
| **0.2** | Optional login | Unlocks My Bookings, Book on KAYAK, Trips sync | Account optional for search | Light mode only (no dark mode) |
| **0.3** | Read sample prompts | UI suggests example queries | Holiday / World Cup / vibe prompts (blog) | Prompt-writing guide on KAYAK blog |

---

### Phase 1 — Intent capture (query entered)

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **1.1** | Type NL prompt | e.g. “Flights BOS→London, 2 adults + 2 kids, Dec 20–27” | Full trip description, no form fields | Same query understood if phrased differently (AI Mode) |
| **1.2** | Vague / exploratory query | e.g. “Where can I go from NYC under $300?” | **Where to Go** style discovery (Ask KAYAK lineage) | Multi-city / multi-product in one thread |
| **1.3** | Follow-up refinement | “Nonstop only”, “hotel with gym near Central Park” | Chat context retained; brief updated | AI explains **no results** and suggests loosening filters |
| **1.4** | Intent → structured search | ChatGPT extracts dates, O&D, pax, constraints | Richer context than form fields (official claim) | Routes to flights **and/or** hotels **and/or** cars **and/or** packages **and/or** activities |

**Behavioral insight (fact, Keller):** 100,000+ AI conversations/month; users use AI for **exploration** but revert to structured search before committing — drove split-pane Ask AI design.

---

### Phase 2 — Search execution & result surfacing

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **2.1** | Wait for results | Metasearch fan-out to provider feeds | Live prices, bookable options | Compares “hundreds to thousands” of sites (general KAYAK) |
| **2.2** | View split pane (Ask AI) | Chat left; **traditional results panel updates in sync** | Core differentiator vs chat-only bots | No tab switch, no search restart |
| **2.3** | Scan chat result cards | Clickable flight/hotel/car cards in thread | Expand / **collapse** cards for clutter control | Map view: up to **9 hotel pins** |
| **2.4** | Use filter pills | Click NL-derived **filter pills** above results | Smart Filters: star rating, amenities, airlines, etc. | Works on Flights, Stays, Cars |
| **2.5** | Use classic filters | Price, stops, airlines, cabin, cancellation | Same trust layer as non-AI search | Sort, airline filters, time windows |
| **2.6** | Side-by-side compare | Select up to **3 hotels or cars** (desktop) | Compare price, policies, fuel, cancellation | **Not in native app** (per blogs) |
| **2.7** | Package results | Flight + hotel **total price** in panel | Adjust filters in conversation | “View deal” opens standard package flow |
| **2.8** | Informational Q&A | “Cheapest day to fly?”, destination advice | Answers with **source links** | Independent test: advisory layer weaker than search layer |
| **2.9** | Price trends (kayak.ai) | Graphs: cheapest weekends, daily hover | World Cup dashboard for macro trends | KAYAK.ai: flight status for **saved** logged-in trips |
| **2.10** | Share planning | Share read-only chat link | Transfer to **KAYAK Trips** for collaboration | View vs edit permissions on shared trips |

---

### Phase 3 — Evaluation & decision

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **3.1** | Open offer detail | Fare rules, baggage, layovers, provider label | “Book with Airline” vs “Book with Partner” | Provider quality scores (2024 suite) |
| **3.2** | Compare trade-offs | User weighs price vs convenience | AI may **miss obvious trade-offs** on first answer (independent test) | Improves on **second prompt** — user must challenge |
| **3.3** | Set Price Alert | If not ready to book | Standard KAYAK feature from results | — |
| **3.4** | Verify policies | Cancellation, bags, pet-friendly | “Pet-friendly” ≠ verified weight limits (test finding) | Hotel amenity claims need user verification |

---

### Phase 4 — Booking handoff (not in chat)

**Fact (official help):** *“The short answer is no: you don’t book with Ask AI. You search and compare.”*

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **4.1** | Click **View Deal** | Exits pure chat UX → KAYAK results/detail page | Same for flights, hotels, cars, packages | — |
| **4.2** | Choose booking path | **A:** Stay on KAYAK (**Book on KAYAK**, logged-in) | Embedded 3rd-party checkout without leaving domain | **B:** Redirect to provider site |
| **4.3** | Provider checkout | Payment on airline / OTA / hotel / car site | Credit card, Apple Pay, Google Pay (partner-dependent) | Seat selection & ancillaries at **checkout**, not in AI chat |
| **4.4** | Confirmation | Email from **provider**, not KAYAK | KAYAK does not ticket | Charge appears on provider merchant name |

**Inference (secondary test, Travel Anywhere blog):** AI “negotiates” itinerary in conversation, then confirms selection before checkout handoff — conversational framing, not a separate booking API.

---

### Phase 5 — Post-booking

| Step | User action | System behavior | Major | Minor |
|---|---|---|---|---|
| **5.1** | My Bookings (logged in) | Reference view inside Ask AI | **Sync delays possible** — verify with provider | — |
| **5.2** | KAYAK Trips | Forward confirmation to **trips@kayak.com** | Gmail auto-sync; SMS flight alerts | Auto-share new trips setting |
| **5.3** | Changes / cancel | Contact **provider directly** | KAYAK cannot modify bookings | Use confirmation email + partner site |
| **5.4** | Flight status | kayak.ai logged-in: delays/gates for saved trips | Requires saved trip | — |

---

## How KAYAK ensures accuracy (and where it fails)

### Structural accuracy mechanisms (official)

| Mechanism | What it does |
|---|---|
| **Live inventory grounding** | Prices come from metasearch API responses, not LLM-generated fares |
| **Full results panel** | User sees entire result set, not 3 curated AI picks |
| **Traditional filters + Smart Filters** | NL → verifiable filter pills; manual override always available |
| **Provider labels** | Clear book-with-airline vs OTA attribution |
| **Explains gaps** | Says when data insufficient (e.g. “cheapest time to fly”) |
| **Source links** | Informational answers cite external sources |
| **Legal disclaimer** | AI content “as-is”; no accuracy warranty ([kayak.ai terms](https://kayak.ai/terms-of-use)) |
| **Experimental flag** | Features change; users told to verify at checkout |

### Independent testing (Travel AI Playbook, Jun 2026)

**Strengths:**
- Live inventory beside chat = “right pattern for travel AI”
- Flexible dates and airport strategy work after refinement
- Rebuilds (e.g. pet-friendly) work with appropriate caveats

**Weaknesses:**
- Missed obvious trade-offs on first answer (e.g. 60% savings on 1-stop vs direct)
- Destination/weather advice unreliable (suggested “cooler” cities that are hot in August)
- Thin hotel policy explanations
- **Burden on user** to send follow-up prompts

> *“KAYAK’s AI is a better search interface, not yet a strong travel advisor.”*  
> — [Travel AI Playbook](https://www.travelaiplaybook.com/p/we-tested-kayak-s-ai-it-is-better-at-search-than-travel-advice)

### Price accuracy caveats (official)

- Prices change constantly; checkout price may differ
- Currency conversion is informational
- KAYAK not responsible for provider data errors

---

## Major functionality catalog

| Category | Capabilities |
|---|---|
| **Search modalities** | Flights, hotels, cars, flight+hotel packages, activities |
| **NL entry** | Full trip prompts, vague inspiration, filter-on-SERP |
| **Refinement** | Multi-turn chat, filter pills, classic filters, collapse cards |
| **Comparison** | Side-by-side (desktop, hotels/cars), full SERP panel |
| **Discovery** | “Where to go”, flexible dates, multi-city / World Cup itineraries |
| **Commercial** | View Deal, Book on KAYAK, redirect to provider |
| **Account** | My Bookings, Trips sync, share chat (read-only), share Trip (view/edit) |
| **Adjacent** | PriceCheck OCR, Price Alerts, World Cup dashboard, Copilot Actions |
| **Feedback** | In-product thumbs + [kayak.ai/feedback/form](https://kayak.ai/feedback/form) |

---

## Minor functionality catalog

| Feature | Detail |
|---|---|
| Filter pills | Click to add/remove NL-derived constraints without retyping |
| Collapse result cards | Cleaner chat when many offers returned |
| Map pins | Up to 9 hotels on map |
| Package totals | Combined flight+hotel price in Ask AI results |
| Prompt examples | Holiday, Hallmark-movie vibe, NYE party, etc. (AI Mode blog) |
| Light mode only | No dark mode for Ask AI |
| Voice entry | Announced for AI Mode; timeline unclear |
| Web search (kayak.ai) | ChatGPT web for non-inventory Qs — Skift: external links, mixed quality |
| Provider Quality Scores | OTA rating in 2024 AI suite |
| Auto-share Trips | Account setting for collaborators |
| Chat with KAYAK support | Feedback form; data may be shared with vendors mentioned |
| Experimental behavior | Help warns features may change |

---

## What Ask AI explicitly does NOT do

| Limitation | Source |
|---|---|
| Process payment in chat | [Help: Can I book directly on Ask AI?](https://www.kayak.com/c/help/search/) |
| Act as ticket seller / travel agent | Help, About |
| Guarantee AI advisory accuracy | kayak.ai Terms |
| Replace traditional search at decision time | Keller, CX Today |
| Book non-travel queries | Help troubleshooting |
| Save arbitrary trip items to Trips (kayak.ai) | Skift: flights/hotels only |
| Side-by-side compare in app | Blog / help gaps |

---

## Timeline (product evolution)

```
Mar 2023   ChatGPT plugin (links out) — discontinued
Mar 2024   Ask KAYAK + PriceCheck + Smart Filters
Apr 2025   KAYAK.ai test lab + Copilot Actions
Oct 2025   AI Mode on kayak.com homepage (ChatGPT + live search)
Apr 2026   Ask AI — chat + live results panel; World Cup dashboard
```

---

## Implications for FlightOne / Ava

KAYAK validates a pattern FlightOne should mirror for **price honesty**:

1. **LLM orchestrates; server owns inventory** — never generate fares in prose alone.
2. **Always show structured offers** beside chat (cards or SERP), not chat-only suggestions.
3. **Hand off before payment** — metasearch legal model; checkout is a known, audited surface.
4. **Smart Filters > clever prose** — invest in NL → constraint translation.
5. **Treat advisory as weak** until policy/weather/trade-off reasoning is tested.
6. **Expect iterative users** — design for mid-conversation brief changes without search restart.

KAYAK **stops short** of in-chat booking; FlightOne may go further via Module 03, but the **verification layer** (live supplier adapter, revalidate before pay) should mirror KAYAK’s split between conversation and truth.

---

## Sources

**Official KAYAK**
- [Ask AI launch](https://www.kayak.com/news/ask-ai/)
- [AI Mode launch](https://www.kayak.com/news/ai-mode/)
- [ChatGPT integration (2023)](https://www.kayak.com/news/kayak-chatgpt/)
- [Search & discovery help](https://www.kayak.com/c/help/search/)
- [World Cup trends](https://www.kayak.com/c/soccer-2026-travel-trends/)

**Trade / analysis**
- [CX Today — Keller interview](https://www.cxtoday.com/customer-engagement-journey-orchestration/kayak-ask-ai-conversational-travel-planning/)
- [Skift — KAYAK.ai review](https://skift.com/2025/05/28/can-kayak-ai-solve-travels-complex-problems-heres-how-it-works/)
- [Skift — AI Mode](https://skift.com/2025/10/15/kayak-ai-mode-natural-language-search/)
- [Travel AI Playbook — hands-on test](https://www.travelaiplaybook.com/p/we-tested-kayak-s-ai-it-is-better-at-search-than-travel-advice)
- [OTA News — Ask AI launch](https://www.ota-news.com/kayak/kayak-launches-ask-ai-for-conversational-trip-planning-in-us-uk-and-canada)
- [PR Newswire — AI Mode](https://www.prnewswire.com/news-releases/kayak-introduces-ai-mode-conversational-travel-search-just-in-time-for-holiday-planning-302584973.html)

---

*Internal research. Not affiliated with KAYAK. Product changes frequently — re-check official help before commercial decisions.*

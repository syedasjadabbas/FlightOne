/**
 * LLM #1 — extract a validated TravelPlan (supplier search legs or clarify/close).
 */
import { complete, type ChatTurn } from "@/lib/llm";
import { PLACE_TO_IATA, placeToIata } from "@/lib/inventory/places";
import type { TravellerLocation } from "@/lib/geo/types";
import { extractTravelPlanDeterministic } from "./extractTravelPlanDeterministic";
import { looksComplexForHeuristic } from "./intent";
import { complexTripLlmFallbackAsk } from "./serviceMessages";
import { parseTravelPlan, type TravelPlan } from "./travelPlan";

export interface ExtractTravelPlanOpts {
  today: string;
  defaultOriginIata: string;
  defaultOriginPlace: string;
  location?: TravellerLocation | null;
  /** Prior turn plan for deterministic multi-turn continuity when LLM is down. */
  previousTravelPlan?: TravelPlan | null;
}

function iataHintList(limit = 24): string {
  return Object.entries(PLACE_TO_IATA)
    .slice(0, limit)
    .map(([place, code]) => `${place}=${code}`)
    .join(", ");
}

function buildExtractSystem(opts: ExtractTravelPlanOpts): string {
  const currency = opts.location?.currency;
  return [
    `You convert a travel chat into ONE JSON object for FlightOne search.`,
    `Today is ${opts.today} (UTC date). Traveller default origin: ${opts.defaultOriginPlace} (${opts.defaultOriginIata}).`,
    currency ? `Preferred currency code: ${currency}.` : "",
    ``,
    `Output STRICT JSON only — no markdown, no commentary, no trailing commas.`,
    `Use 3-letter IATA codes for origin/destination/cityCode (Lahore=LHE, London=LHR, Madinah=MED).`,
    `Dates must be YYYY-MM-DD.`,
    ``,
    `OUTPUT SCHEMA (emit exactly one object; all fields shown — omit optional keys when unused):`,
    `{`,
    `  "action": "search" | "package" | "clarify" | "close" | "off_topic",`,
    `  "searches": [`,
    `    {`,
    `      "product": "FLIGHT",`,
    `      "query": {`,
    `        "origin": "LHE",`,
    `        "destination": "LHR",`,
    `        "departureDate": "YYYY-MM-DD",`,
    `        "returnDate": "YYYY-MM-DD",`,
    `        "passengers": 1,`,
    `        "cabinClass": "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST",`,
    `        "requestedCurrency": "PKR"`,
    `      }`,
    `    },`,
    `    {`,
    `      "product": "HOTEL",`,
    `      "query": {`,
    `        "cityCode": "LHR",`,
    `        "checkInDate": "YYYY-MM-DD",`,
    `        "checkOutDate": "YYYY-MM-DD",`,
    `        "rooms": 1,`,
    `        "guests": 2,`,
    `        "hotelName": "optional property name",`,
    `        "requestedCurrency": "PKR"`,
    `      }`,
    `    }`,
    `  ],`,
    `  "datesAssumed": false,`,
    `  "includePackages": false,`,
    `  "filters": {`,
    `    "nonstopOnly": false,`,
    `    "maxStops": 1,`,
    `    "refundableOnly": false,`,
    `    "preferredAirlines": ["QR", "SV"],`,
    `    "airlinesOnly": ["EK"],`,
    `    "maxLayoverMinutes": 120,`,
    `    "departAfterLocal": "14:00",`,
    `    "departBeforeLocal": "22:00",`,
    `    "checkedBagRequired": false`,
    `  },`,
    `  "missing": ["destination"],`,
    `  "ask": "short clarify question",`,
    `  "origin": "LHE",`,
    `  "destination": "MLE",`,
    `  "minStars": 4,`,
    `  "passengers": 2,`,
    `  "departureDate": "YYYY-MM-DD",`,
    `  "returnDate": "YYYY-MM-DD"`,
    `}`,
    `- action=search → require searches[] (1–6 legs). returnDate only on simple same-airline RT; omit on one-ways.`,
    `- action=package → origin, destination; optional minStars, passengers, departureDate, returnDate, datesAssumed.`,
    `- action=clarify → ask (required) + missing[].`,
    `- action=close | off_topic → {"action":"close"} or {"action":"off_topic"} only.`,
    ``,
    `SAMPLE (complex return — Qatar out, Saudia via Madinah layover; no returnDate on legs):`,
    `{"action":"search","searches":[{"product":"FLIGHT","query":{"origin":"LHE","destination":"LHR","departureDate":"2026-08-21","passengers":1,"cabinClass":"ECONOMY"}},{"product":"FLIGHT","query":{"origin":"LHR","destination":"MED","departureDate":"2026-08-25","passengers":1,"cabinClass":"ECONOMY"}},{"product":"FLIGHT","query":{"origin":"MED","destination":"LHE","departureDate":"2026-08-28","passengers":1,"cabinClass":"ECONOMY"}}],"datesAssumed":false,"filters":{"preferredAirlines":["QR","SV"]}}`,
    ``,
    `SAMPLE (simple round trip — stay nights only):`,
    `{"action":"search","searches":[{"product":"FLIGHT","query":{"origin":"${opts.defaultOriginIata}","destination":"LHR","departureDate":"2026-08-21","returnDate":"2026-08-25","passengers":1,"cabinClass":"ECONOMY"}}],"datesAssumed":false}`,
    ``,
    `Actions (pick exactly one):`,
    `1. search — GDS legs (FLIGHT/HOTEL), 1–6`,
    `2. package — custom/seed tour package ask (honeymoon, family package, holiday package)`,
    `3. clarify — missing critical info; ask ONE short question`,
    `4. close — customer accepts / wants to book a SPECIFIC shown option ("yes", "book it", "lock it in")`,
    `5. off_topic — clearly not about travel booking, OR a capability we do not offer (see CAPABILITY GAPS below)`,
    `6. Greeting only ("hi", "hello", "hey", "good morning") → clarify with a warm destination ask. Never invent a search.`,
    ``,
    `NOT a close (never emit "close" for these — they are shopping/comparison, still on a "search" or "off_topic" turn):`,
    `- "where can I book it cheapest" / "which seller is cheapest" / "compare prices" / "X vs Y" / "safer than [OTA]" — comparison shopping, not acceptance.`,
    `- "confirm if [airline] is available" — an availability check, not acceptance.`,
    `- "No" / "nope" / "none of these" / "not that" — rejection of shown options; emit clarify asking what to change (dates, airline, route), NEVER "close".`,
    ``,
    `CAPABILITY GAPS — action "off_topic" (we do not book/search these; never invent a search or ask for names/dates for them):`,
    `- Car hire / car rental / road trip routing.`,
    `- Save / shortlist / watchlist / price-drop alerts / price tracking ("save these", "watch this price").`,
    `- CO2 / carbon / "greener" flight comparisons; other sellers' ratings/trust (Kiwi, Expedia, "which OTA is safer").`,
    `- Fare-brand baggage matrices with no route/dates given.`,
    `- Open-ended "anywhere/everywhere" discovery, or "cheapest month to fly" with no window.`,
    ``,
    `PASSENGERS / PARTY:`,
    `- ONLY set passengers>1 for clear headcount: "for 4", "2 adults", "group of 10", "we are 3", "party of 2" (clamp 1–9; group of 10 → 9). Apply on EVERY flight leg; hotel guests ≥ passengers.`,
    `- NEVER treat stay length as party size. "4 nights", "for 4 nights", "3 day layover", "stay 5 days" → passengers=1 (unless they also said adults/travellers/group).`,
    `- Default passengers=1, hotel guests=2 only when party size never mentioned.`,
    ``,
    `DATES:`,
    `- Resolve relative dates against today=${opts.today}. If month/day already passed this year, use next year.`,
    `- Round-trip / return / "there and back": set returnDate on the FIRST (or only) flight when a single destination.`,
    `- Multi-city with a date window: split across hops (start = first date; later hops inside window).`,
    `- No calendar dates but trip SHAPE is complete (origin choices, stopover nights, stay length, return city): action=search — pick ≈ today+21 as first departure, cascade stay/stopover nights onto later legs, set "datesAssumed":true. Do NOT clarify just for missing calendar dates.`,
    `- Example: "Lahore or Islamabad → SFO via 2 nights London, stay SFO 15 days, return Orlando" → three OW flights LHE→LHR, LHR→SFO (+2 nights), MCO→LHE (+15 days from SFO arrival), datesAssumed:true.`,
    `- "flexible dates" / "cheapest week" / "whenever" with a destination: clarify ONE question for a target month, OR search with datesAssumed:true if they insist on options now.`,
    `- "Stay in London for 4 nights" → hotel checkIn/checkOut span (or returnDate ≈ outbound+4), NOT passengers=4.`,
    ``,
    `MULTI-CITY / MIXED:`,
    `- "London then Dubai" → SEPARATE FLIGHT legs per hop. Never collapse two cities into one search.`,
    `- Chain: dest of leg N = origin of leg N+1 unless user says otherwise.`,
    `- Complex RETURN: layover/stopover ("3 day layover in Madinah", "return layover in Bangkok for 2 nights"), return on a different airline, open-jaw → SEPARATE one-way FLIGHT legs (no returnDate on any leg). ALWAYS end with a final leg home when they say "back to" / "then back". Example Bali leisure: LHE→DPS outbound; DPS→BKK after stay nights; BKK→LHE after layover nights.`,
    `- SAMPLE leisure multi-stop: "Bali 25 Aug, 4 nights, return layover Bangkok 2 nights then back to Lahore" → three OW flights: LHE→DPS 2026-08-25; DPS→BKK 2026-08-29; BKK→LHE 2026-08-31.`,
    `- Simple night stay only ("stay 4 nights") with same airline both ways: ONE flight with returnDate is OK (round trip).`,
    `- FLEXIBLE RETURN AIRPORT within the SAME metro/country ("return can be from any city in the UAE", "any airport near Dubai is fine") is NOT a complex/open-jaw return — it is still ONE flight with returnDate, destination = your single best-guess city (e.g. DXB for Dubai). Do NOT try to enumerate DXB/AUH/SHJ yourself and do NOT split this into multiple legs — the search layer automatically checks every nearby airport for the best combined fare once it has one simple round-trip query. Splitting it yourself would suppress that.`,
    `- "flight"/"fly"/"nonstop flight" without hotel words → FLIGHT legs ONLY. Never emit HOTEL for a pure flight ask.`,
    `- "hotel"/"stay" without flight words → HOTEL legs ONLY.`,
    `- Hotels per stop when they ask for stays/nights in each city.`,
    ``,
    `PACKAGES / CUSTOM TOURS:`,
    `- honeymoon package, family package, custom package, holiday/vacation package, "itinerary for…" → action "package" (not only a flight).`,
    `- Still use search with FLIGHT+HOTEL when they clearly want live air+stay only.`,
    ``,
    `REFINE (use full chat history):`,
    `- "nonstop" / "direct" → filters.nonstopOnly=true (re-search same route). Still search and surface directs first even without that filter — pitch time-saving directs when available.`,
    `- "max 1 stop" → filters.maxStops=1.`,
    `- "refundable only" → filters.refundableOnly=true.`,
    `- "no more than N hours layover/connection" / "max 90 min connection" / "don't make me wait more than N hours" → filters.maxLayoverMinutes (minutes).`,
    `- "after 2pm" / "leaving after 14:00" → filters.departAfterLocal "14:00". "before 9am" → filters.departBeforeLocal "09:00".`,
    `- "with a checked bag" / "need checked baggage" → filters.checkedBagRequired=true.`,
    `- Named airline ("Qatar", "QR", "Saudia"/"SV", "Emirates"/"EK") → filters.preferredAirlines IATA codes in preference order (soft — never drops other carriers). Still action "search" — never "close".`,
    `- "Emirates ONLY" / "only fly Qatar" / "only on EK" → filters.airlinesOnly (hard — drop other carriers entirely; distinct from preferredAirlines).`,
    `- "confirm if X is available" is a shopping check, NOT close.`,
    `- "make it business" / cheaper / different dates → new search with updated fields; keep prior origin/dest from history.`,
    ``,
    `Other rules:`,
    `- IATA hubs: ${iataHintList()}. London→LHR. Madinah→MED. Bali/Denpasar→DPS. Bangkok→BKK.`,
    `- Origin missing on first flight: ${opts.defaultOriginIata}.`,
    `- Destination/city missing: clarify — do not invent.`,
    `- Named hotels → HOTEL leg with hotelName + cityCode.`,
    `- cabin business→BUSINESS; premium→PREMIUM_ECONOMY; else ECONOMY.`,
    `- Only FLIGHT/HOTEL in searches[]. Max 6 legs.`,
    currency ? `- Hotels may set requestedCurrency ${currency}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function completePlanJson(
  system: string,
  messages: ChatTurn[],
  opts?: { timeoutMs?: number },
): Promise<{ text: string; provider: string } | null> {
  return complete({
    system,
    messages,
    temperature: 0,
    // Multi-leg open-jaw JSON is large; keep headroom so thinking models
    // (Qwen3 in LM Studio) don't starve the JSON payload.
    maxTokens: 1600,
    timeoutMs: opts?.timeoutMs ?? 120000,
    json: true,
  });
}

/**
 * Structured, greppable telemetry for the extraction pipeline. Only
 * degraded-mode exits are logged (a repair was needed, or extraction gave up
 * entirely) — a clean first-try success is the expected case and logging it
 * every turn would just be noise. Consistent `[extract-travel-plan]` prefix
 * and a `stage` field so production logs can be aggregated into a real
 * reliability number — "what fraction of turns needed repair, and how many
 * fell through to heuristic entirely" — instead of that being invisible,
 * which it was before this change.
 */
function logStage(
  stage: "repair1_ok" | "repair2_ok" | "gave_up" | "no_provider",
  detail: { message: string } & Record<string, unknown>,
) {
  const { message, ...rest } = detail;
  console.warn(`[extract-travel-plan] ${stage}`, {
    ...rest,
    messagePreview: message.slice(0, 160),
  });
}

/**
 * When the LLM is down or returns junk: try deterministic single-leg extract,
 * else an honest complex-trip clarify — never a fake "where do you want to go".
 */
function fallbackWhenLlmUnavailable(
  message: string,
  history: ChatTurn[],
  opts: ExtractTravelPlanOpts,
): TravelPlan | null {
  const originIata = placeToIata(opts.defaultOriginPlace) || opts.defaultOriginIata;
  const det = extractTravelPlanDeterministic(message, {
    today: opts.today,
    defaultOriginIata: originIata,
    defaultOriginPlace: opts.defaultOriginPlace,
    previousPlan: opts.previousTravelPlan ?? null,
    history,
  });
  if (det.kind === "plan" || det.kind === "clarify") return det.plan;

  if (looksComplexForHeuristic(message)) {
    return {
      action: "clarify",
      missing: ["departureDate"],
      ask: complexTripLlmFallbackAsk(),
    };
  }
  return null;
}

/**
 * Returns a validated TravelPlan, or a deterministic / honest fallback when the
 * LLM is unavailable. Null only when there is nothing useful to ask or search.
 */
export async function extractTravelPlan(
  message: string,
  history: ChatTurn[],
  opts: ExtractTravelPlanOpts,
): Promise<TravelPlan | null> {
  const originIata = placeToIata(opts.defaultOriginPlace) || opts.defaultOriginIata;
  const system = buildExtractSystem({ ...opts, defaultOriginIata: originIata });

  const messages: ChatTurn[] = [
    ...history.slice(-8),
    { role: "user", content: message },
  ];

  const llm = await completePlanJson(system, messages);
  if (!llm?.text) {
    logStage("no_provider", { message });
    return fallbackWhenLlmUnavailable(message, history, opts);
  }

  const plan = parseTravelPlan(llm.text);
  if (plan) return plan;

  // Repair pass 1 — gemma4 often wraps commentary or truncates braces on a
  // cold/loaded run. Ask it to fix its OWN broken output rather than re-derive
  // the plan from scratch, which is a much smaller, more reliable task.
  const repair1 = await completePlanJson(
    `Fix the following into ONE valid TravelPlan JSON object only. Rules: IATA codes, YYYY-MM-DD dates, action search|package|clarify|close|off_topic. No markdown.`,
    [
      {
        role: "user",
        content: `Original ask:\n${message}\n\nBroken model output:\n${llm.text.slice(0, 2500)}`,
      },
    ],
    { timeoutMs: 45000 },
  );

  if (repair1?.text) {
    const repaired1 = parseTravelPlan(repair1.text);
    if (repaired1) {
      logStage("repair1_ok", { provider: repair1.provider, message });
      return repaired1;
    }
  }

  // Repair pass 2 — a DIFFERENT strategy from repair 1, not the same prompt
  // again. Repair 1 assumes the JSON is close but malformed; if that also
  // failed, the model likely couldn't decide on the plan's SHAPE (how many
  // legs, which action) rather than just its syntax. Re-derive from the
  // original ask with an explicit, much narrower escape hatch: if a full
  // multi-leg plan can't be built with confidence, emit "clarify" instead of
  // a wrong or partial "search" — a clarify still reaches the customer with
  // an honest question, instead of falling all the way through to the
  // heuristic parser, which cannot represent a multi-leg trip AT ALL.
  const repair2 = await completePlanJson(
    `${system}\n\nSTRICT MODE: your previous two attempts to plan this trip were invalid JSON or an invalid plan. This time: if you are not fully confident of every leg (all cities, all dates), emit {"action":"clarify","missing":[...],"ask":"..."} instead of guessing. A valid, honest clarify beats an invalid or wrong search.`,
    messages,
    { timeoutMs: 30000 },
  );

  if (repair2?.text) {
    const repaired2 = parseTravelPlan(repair2.text);
    if (repaired2) {
      logStage("repair2_ok", { provider: repair2.provider, message });
      return repaired2;
    }
  }

  logStage("gave_up", {
    provider: llm.provider,
    message,
    firstTryPreview: llm.text.slice(0, 120).replace(/\s+/g, " "),
  });
  return fallbackWhenLlmUnavailable(message, history, opts);
}

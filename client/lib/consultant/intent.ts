import { knownPlaces } from "@/lib/inventory/inventory";
import { isKnownIata, iataToPlace, resolvePlaceOrIata } from "@/lib/inventory/places";
import type { ChatTurn } from "@/lib/llm";
import { matchKnownHotel } from "./knownHotels";
import { extractPreferredAirlines } from "./airlines";
import type { ExtractedIntent } from "./types";

/**
 * Heuristic intent extraction (slot-filling) — Module 01.
 *
 * Deliberately dependency-free and deterministic: it parses origin/destination,
 * offer type, budget, cabin and star rating from natural language against the
 * places we actually have inventory for. Good enough to drive retrieval; the LLM
 * still does the nuanced conversation on top. When real NLU lands this is the one
 * place to swap.
 */

const PLACES = knownPlaces();

const TYPE_WORDS: Record<string, ExtractedIntent["type"]> = {
  flight: "flight",
  flights: "flight",
  fly: "flight",
  ticket: "flight",
  tickets: "flight",
  airfare: "flight",
  hotel: "hotel",
  hotels: "hotel",
  stay: "hotel",
  room: "hotel",
  rooms: "hotel",
  accommodation: "hotel",
  package: "package",
  bundle: "package",
  holiday: "package",
  vacation: "package",
  "flight+hotel": "package",
};

const OFF_TOPIC_HINTS = [
  "weather",
  "joke",
  "who are you",
  "what can you do",
  "recipe",
  "news",
];

/**
 * Language that signals a multi-leg / return / stopover itinerary — exactly
 * the shape the heuristic parser below CANNOT represent (it only ever
 * extracts one origin and one destination, no dates, no legs).
 */
const COMPLEX_ITINERARY_HINTS =
  /\b(stopover|stop\s?over|layover|via\b|transit|connecting through|open[-\s]?jaw|return(?:ing)?\s+(?:from|via)|then\s+back|back\s+to|any\s+(?:city|airport)\s+(?:in|from))\b/i;

/**
 * Matches travel-agent routing shorthand: 3-letter codes chained with a
 * hyphen/dash/arrow — "LHE-LHR-SFO-MCO-LHE", "lhe – dxb – lhe". This is how
 * agents actually type routes in practice, and `knownPlaces()` (full city
 * NAMES like "Lahore") never matches bare IATA codes at all — without this,
 * the exact shorthand real agents use would slip past the complexity check
 * entirely.
 */
const IATA_CHAIN = /\b[a-z]{3}(?:\s*[-–—]\s*[a-z]{3}|\s*(?:>|→)\s*[a-z]{3}){1,}\b/gi;

/**
 * Distinct 3-letter codes across every routing chain in the message. Counts
 * DISTINCT codes, not hops — "LHE-SHJ-LHE" is a simple there-and-back (2
 * distinct cities) and must NOT be flagged; "LHE-LHR-SFO-MCO-LHE" is a real
 * multi-city chain (4 distinct cities) and must.
 */
function distinctIataCodesInChains(message: string): number {
  const chains = message.match(IATA_CHAIN) ?? [];
  const codes = new Set<string>();
  for (const chain of chains) {
    for (const code of chain.match(/[a-z]{3}/gi) ?? []) {
      codes.add(code.toLowerCase());
    }
  }
  return codes.size;
}

/**
 * True when a message describes a trip shape the heuristic parser is
 * structurally unable to handle — multiple cities/legs, a stopover, or an
 * open-jaw return (different return city/airport than the outbound).
 *
 * This exists so the orchestrator can tell the difference between "the LLM
 * failed on a simple ask, the heuristic fallback is fine" and "the LLM failed
 * on a trip the fallback would silently mangle into a wrong single-leg
 * answer." See orchestrator.ts's guardrail around `runHeuristic`.
 */
export function looksComplexForHeuristic(message: string): boolean {
  if (COMPLEX_ITINERARY_HINTS.test(message)) return true;

  // 3+ distinct known places (full city names) in one message — "Lahore
  // London San Francisco Orlando Lahore" — even without explicit "stopover"
  // language.
  const places = new Set(findPlaces(message).map((p) => p.place));
  if (places.size >= 3) return true;

  // Same signal, but for bare IATA-code shorthand ("LHE-LHR-SFO-MCO-LHE"),
  // which knownPlaces()/findPlaces() never matches (it only knows city names).
  return distinctIataCodesInChains(message) >= 3;
}

function findPlaces(text: string): { place: string; index: number }[] {
  const lower = text.toLowerCase();
  const hits: { place: string; index: number }[] = [];
  for (const place of PLACES) {
    const p = place.toLowerCase();
    const idx = lower.indexOf(p);
    if (idx >= 0) hits.push({ place, index: idx });
  }

  // Bare IATA codes ("LHE to DXB") — knownPlaces() only knows city names.
  for (const m of text.matchAll(/\b([A-Za-z]{3})\b/g)) {
    const code = m[1].toUpperCase();
    if (!isKnownIata(code)) continue;
    const idx = m.index ?? 0;
    hits.push({ place: iataToPlace(code), index: idx });
  }

  // Sort by appearance order; dedupe overlapping (e.g. "New York" vs a substring).
  const seen = new Set<string>();
  return hits
    .sort((a, b) => a.index - b.index)
    .filter((h) => {
      const key = h.place.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Parse a single message into a partial intent. */
function extractOne(message: string): ExtractedIntent {
  const text = message.toLowerCase();
  const intent: ExtractedIntent = { offTopic: false };

  // Type
  for (const [word, type] of Object.entries(TYPE_WORDS)) {
    if (new RegExp(`\\b${word.replace("+", "\\+")}\\b`).test(text)) {
      intent.type = type;
      break;
    }
  }

  // Origin / destination via "from X to Y" or "X to Y" or "to Y" / "in Y"
  const places = findPlaces(message);
  const toMatch = text.match(/\bto\s+([a-z ]+)/);
  const fromMatch = text.match(/\bfrom\s+([a-z ]+)/);

  const placeAt = (frag?: string): string | undefined => {
    if (!frag) return undefined;
    const resolved = resolvePlaceOrIata(frag.trim());
    if (resolved) return iataToPlace(resolved);
    const p = findPlaces(frag)[0];
    return p?.place;
  };

  const dest = placeAt(toMatch?.[1]);
  const origin = placeAt(fromMatch?.[1]);
  if (dest) intent.destination = dest;
  if (origin) intent.origin = origin;

  // "hotel in Paris" / "stay in Dubai" / "Burj Al Arab in Dubai" → destination/city.
  // "in <city>" (as opposed to "to <city>") reads as staying there → hotel-ish.
  let destFromIn = false;
  if (!intent.destination) {
    const inMatch = text.match(/\bin\s+([a-z ]+)/);
    const inPlace = placeAt(inMatch?.[1]);
    if (inPlace) {
      intent.destination = inPlace;
      destFromIn = true;
    }
  }

  // Positional inference. Places appear in the message in order, so with two or
  // more places ("London to Paris", "London Paris") the first is the origin and
  // the last is the destination — this catches "X to Y" where only "to" is
  // present (no "from"), which the regexes above miss.
  if (places.length >= 2) {
    if (!intent.origin) intent.origin = places[0].place;
    if (!intent.destination) intent.destination = places[places.length - 1].place;
    // Guard: never let origin === destination.
    if (intent.origin === intent.destination) intent.origin = undefined;
  } else if (places.length === 1 && !intent.destination && !intent.origin) {
    intent.destination = places[0].place;
  }

  // Budget: "$500", "under 500", "budget 800", "500 dollars", "1.2k"
  const budget = parseBudget(text);
  if (budget != null) intent.maxBudgetMinor = budget;

  // Cabin
  if (/\bbusiness\b/.test(text)) intent.cabin = "business";
  else if (/\bpremium\b/.test(text)) intent.cabin = "premium";
  else if (/\beconomy\b/.test(text)) intent.cabin = "economy";

  // Stars
  const stars = text.match(/(\d)\s*[- ]?\s*star/);
  if (stars) intent.minStars = Math.min(5, Math.max(1, Number(stars[1])));

  // Party size: "for 4", "group of 10", "2 adults", "3 travellers"
  const passengers = parsePassengers(text);
  if (passengers != null) intent.passengers = passengers;

  // Refine filters
  if (/\b(non[-\s]?stop|direct(?: flight)?s?)\b/.test(text)) {
    intent.filters = { ...intent.filters, nonstopOnly: true, maxStops: 0 };
  }
  if (/\brefundable\b/.test(text)) {
    intent.filters = { ...intent.filters, refundableOnly: true };
  }
  if (/\bchecked\s*bag(?:gage)?\b/.test(text)) {
    intent.filters = { ...intent.filters, checkedBagRequired: true };
  }
  // Morning / avoid overnight — map into existing depart window filters (latest message wins via merge).
  if (/\b(prefer morning|morning flights?)\b/.test(text)) {
    intent.filters = {
      ...intent.filters,
      departBeforeLocal: intent.filters?.departBeforeLocal ?? "12:00",
    };
  }
  if (/\b(no overnight|don'?t want overnight|avoid overnight|no red[- ]?eye)\b/.test(text)) {
    intent.filters = {
      ...intent.filters,
      departAfterLocal: intent.filters?.departAfterLocal ?? "06:00",
      departBeforeLocal: intent.filters?.departBeforeLocal ?? "21:00",
    };
  }

  const maxLayoverMinutes = parseMaxLayoverMinutes(text);
  if (maxLayoverMinutes != null) {
    intent.filters = { ...intent.filters, maxLayoverMinutes };
  }
  const departAfterLocal = parseClockTime(text, "after");
  if (departAfterLocal) {
    intent.filters = { ...intent.filters, departAfterLocal };
  }
  const departBeforeLocal = parseClockTime(text, "before");
  if (departBeforeLocal) {
    intent.filters = { ...intent.filters, departBeforeLocal };
  }

  const preferredAirlines = extractPreferredAirlines(message);
  if (preferredAirlines.length > 0) {
    intent.filters = { ...intent.filters, preferredAirlines };
  }
  const airlinesOnly = parseAirlinesOnly(message, preferredAirlines);
  if (airlinesOnly.length > 0) {
    intent.filters = { ...intent.filters, airlinesOnly };
  }

  // Landmark hotel by name → force hotel intent + city (even with no "Dubai" word).
  const known = matchKnownHotel(message);
  if (known) {
    intent.type = "hotel";
    intent.hotelName = known.name;
    if (!intent.destination) intent.destination = known.city;
    if (intent.minStars == null) intent.minStars = known.minStars;
  }

  // Type inference when no explicit type word was used:
  //  - a star rating, or an "in <city>" stay phrasing with no origin, implies a hotel.
  if (!intent.type) {
    if (intent.minStars != null) intent.type = "hotel";
    else if (destFromIn && !intent.origin) intent.type = "hotel";
    else if (intent.origin && intent.destination) intent.type = "flight";
  }

  // Off-topic
  if (OFF_TOPIC_HINTS.some((h) => text.includes(h)) && places.length === 0 && !intent.type) {
    intent.offTopic = true;
  }

  return intent;
}

/** "no more than 2 hours layover", "max 90 min connection", "wait more than 3 hours". */
function parseMaxLayoverMinutes(text: string): number | undefined {
  const hoursMin = text.match(
    /\b(?:no more than|max(?:imum)?|under|less than|don'?t\s+make\s+me\s+wait\s+more\s+than|wait\s+(?:no\s+)?more\s+than)\s+(\d{1,2})\s*(?:hours?|hrs?)(?:\s*(?:and\s*)?(\d{1,2})\s*(?:minutes?|mins?))?(?:\s*(?:layover|lay[\s-]?over|connection))?\b/i,
  );
  if (hoursMin) {
    // Require layover/connection OR an explicit wait-cap phrasing so we don't
    // steal "under 2 hours total flight time" from duration filters later.
    const matchedWait = /wait|don'?t\s+make\s+me/i.test(hoursMin[0]);
    const matchedLayover = /layover|lay[\s-]?over|connection/i.test(hoursMin[0]);
    if (matchedWait || matchedLayover) {
      const hours = Number(hoursMin[1]);
      const minutes = hoursMin[2] ? Number(hoursMin[2]) : 0;
      return hours * 60 + minutes;
    }
  }
  const minutesOnly = text.match(
    /\b(?:no more than|max(?:imum)?|under|less than)\s+(\d{2,3})\s*(?:minutes?|mins?)\s*(?:layover|lay[\s-]?over|connection)\b/i,
  );
  if (minutesOnly) return Number(minutesOnly[1]);
  return undefined;
}

/** "after 2pm" / "leaving after 14:00" / "before 9am" → "HH:MM" (24h). */
function parseClockTime(text: string, boundary: "after" | "before"): string | undefined {
  const hhmm = text.match(new RegExp(`\\b${boundary}\\s+(\\d{1,2}):(\\d{2})\\b`, "i"));
  if (hhmm) return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;

  const ampm = text.match(new RegExp(`\\b${boundary}\\s+(\\d{1,2})\\s*(am|pm)\\b`, "i"));
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[2].toLowerCase() === "pm") hour += 12;
    return `${String(hour).padStart(2, "0")}:00`;
  }
  return undefined;
}

/**
 * Hard carrier lock: "Emirates only" / "only on Emirates" / "only fly Qatar".
 * Requires "only" plus at least one recognized airline mention in the same message.
 */
function parseAirlinesOnly(message: string, preferredAirlines: string[]): string[] {
  if (preferredAirlines.length === 0) return [];
  if (!/\bonly\b/i.test(message)) return [];
  return preferredAirlines;
}

/** Duration words that must not be read as party size ("for 4 nights"). */
const DURATION_UNIT =
  /^(?:nights?|days?|day|hours?|hrs?|weeks?|months?|layovers?)$/i;

/**
 * Party size from natural language. Does NOT treat stay length as passengers
 * ("Stay in London is for 4 nights" → undefined, not 4).
 */
export function parsePassengers(text: string): number | undefined {
  // Prefer explicit headcount phrases first.
  const pax = text.match(
    /\b(\d{1,2})\s*(?:adults?|travellers?|travelers?|people|passengers?|pax)\b/i,
  );
  if (pax) return Math.min(9, Math.max(1, Number(pax[1])));

  const group = text.match(
    /\b(?:group of|party of|we are|family of)\s+(\d{1,2})\b/i,
  );
  if (group) return Math.min(9, Math.max(1, Number(group[1])));

  // Bare "for N" only when N is not a duration ("for 4" ok; "for 4 nights" not).
  const forN = text.match(/\bfor\s+(\d{1,2})\b/i);
  if (forN) {
    const after = text.slice(forN.index! + forN[0].length).trimStart();
    const next = after.split(/\s+/)[0] || "";
    if (DURATION_UNIT.test(next)) return undefined;
    return Math.min(9, Math.max(1, Number(forN[1])));
  }

  return undefined;
}

/** True when the guest (or history) clearly stated a party size. */
export function messageStatesPartySize(
  message: string,
  history: ChatTurn[] = [],
): boolean {
  const turns = [
    ...history.filter((t) => t.role === "user").map((t) => t.content),
    message,
  ];
  return turns.some((t) => parsePassengers(t) != null);
}

function parseBudget(text: string): number | undefined {
  // "1.2k" / "2k"
  const k = text.match(/(?:under|below|max|budget|around|~)?\s*\$?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1000 * 100);
  // "$500" / "500 dollars" / "under 500"
  const m = text.match(
    /(?:under|below|max|budget|around|~|less than|up to)?\s*\$?\s*(\d{2,5})(?:\s*(?:usd|dollars|\$))?/,
  );
  if (m && /(?:under|below|max|budget|around|~|less than|up to|\$|usd|dollar)/.test(text)) {
    return Number(m[1]) * 100;
  }
  return undefined;
}

/**
 * Fold the conversation into a single running intent. Later mentions override
 * earlier ones (so "actually make it business class" updates the cabin), while
 * unспecified fields carry forward.
 */
export function extractIntent(
  message: string,
  history: ChatTurn[],
  opts?: { defaultOrigin?: string },
): ExtractedIntent {
  const merged: ExtractedIntent = { offTopic: false };
  const userTurns = history.filter((t) => t.role === "user").map((t) => t.content);

  for (const text of [...userTurns, message]) {
    const one = extractOne(text);
    if (one.type) merged.type = one.type;
    if (one.origin) merged.origin = one.origin;
    if (one.destination) merged.destination = one.destination;
    if (one.hotelName) merged.hotelName = one.hotelName;
    if (one.maxBudgetMinor != null) merged.maxBudgetMinor = one.maxBudgetMinor;
    if (one.cabin) merged.cabin = one.cabin;
    if (one.minStars != null) merged.minStars = one.minStars;
    if (one.passengers != null) merged.passengers = one.passengers;
    if (one.filters) {
      merged.filters = {
        ...merged.filters,
        ...one.filters,
        preferredAirlines:
          one.filters.preferredAirlines ?? merged.filters?.preferredAirlines,
        airlinesOnly: one.filters.airlinesOnly ?? merged.filters?.airlinesOnly,
      };
    }
  }

  // Off-topic is judged on the CURRENT message only.
  merged.offTopic = extractOne(message).offTopic && !merged.destination;

  // Pitch from the traveller's geo origin when they didn't name one
  // (e.g. "flights to Dubai" → from Karachi / London / …).
  if (!merged.origin && opts?.defaultOrigin && opts.defaultOrigin !== merged.destination) {
    merged.origin = opts.defaultOrigin;
  }

  return merged;
}

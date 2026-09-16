/**
 * LLM travel-plan schema — mirrors filght-one-server suppliers/searchSchema.
 * Supports multi-leg itineraries via searches[] (FLIGHT and/or HOTEL),
 * seed package asks, refine filters, and clarify/close.
 */
import { iataToPlace, addDaysIso, placeToIata, resolvePlaceOrIata } from "@/lib/inventory/places";
import type {
  CabinClass,
  FlightSearchQuery,
  HotelSearchQuery,
  SupplierSearchBody,
} from "@/lib/inventory/supplierSearch";
import type { ChatTurn } from "@/lib/llm";
import { airlineMatchesPreference, extractPreferredAirlines } from "./airlines";
import { extractIntent } from "./intent";
import type { ExtractedIntent, IntentFilters } from "./types";

export type { CabinClass, FlightSearchQuery, HotelSearchQuery };

/** One GDS call: flight segment or hotel city stay. */
export type SearchLeg = SupplierSearchBody;

export type TravelPlan =
  | {
      action: "search";
      searches: SearchLeg[];
      /** Prefer seed package inventory alongside / instead of thin live results. */
      includePackages?: boolean;
      /** Dates were system-defaulted (~today+21), not stated by the user. */
      datesAssumed?: boolean;
      filters?: IntentFilters;
    }
  | {
      action: "package";
      origin: string;
      destination: string;
      minStars?: number;
      departureDate?: string;
      returnDate?: string;
      passengers?: number;
      datesAssumed?: boolean;
    }
  | {
      action: "clarify";
      missing: string[];
      ask: string;
      /**
       * Known search slots preserved while clarifying.
       * Prevents multi-turn loss when the user answers with "yes" / a date / etc.
       */
      draft?: Extract<TravelPlan, { action: "search" }>;
    }
  | { action: "close" }
  | { action: "off_topic" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Za-z]{3}$/;
const CABINS = new Set<CabinClass>(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]);
/** Hard cap so one chat turn cannot fan out unbounded supplier calls. */
/** Hard cap — open-jaw recovery may use up to 7 (positioning leg). */
export const MAX_SEARCH_LEGS = 7;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

function asInt(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isInteger(v)) return undefined;
  if (v < min || v > max) return undefined;
  return v;
}

function parseIsoDate(v: unknown): string | undefined {
  const s = asString(v);
  if (!s || !ISO_DATE.test(s)) return undefined;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) return undefined;
  return s;
}

function parseIata(v: unknown): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  // Gemma often emits "Lahore"/"London" instead of IATA — validate against known airports.
  return resolvePlaceOrIata(s) ?? undefined;
}

export type SearchPlanValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "same_origin_destination"
        | "unknown_origin"
        | "unknown_destination"
        | "invalid_departure_date"
        | "invalid_return_date"
        | "no_flight_legs";
      message: string;
      legIndex?: number;
    };

/** Block Travelport calls when extraction produced an invalid route or dates. */
export function validateSearchPlan(
  plan: Extract<TravelPlan, { action: "search" }>,
): SearchPlanValidation {
  const flightLegs = plan.searches.filter((s) => s.product === "FLIGHT");
  if (flightLegs.length === 0) {
    return { ok: false, code: "no_flight_legs", message: "No flight segments to search." };
  }

  for (let i = 0; i < flightLegs.length; i++) {
    const q = flightLegs[i].query;
    const origin = resolvePlaceOrIata(q.origin);
    const destination = resolvePlaceOrIata(q.destination);

    if (!origin) {
      return {
        ok: false,
        code: "unknown_origin",
        legIndex: i,
        message: `I couldn't verify the departure airport for leg ${i + 1}. Which city are you leaving from?`,
      };
    }
    if (!destination) {
      return {
        ok: false,
        code: "unknown_destination",
        legIndex: i,
        message: `I couldn't verify the destination for leg ${i + 1}. Where would you like to fly to?`,
      };
    }
    if (origin === destination) {
      return {
        ok: false,
        code: "same_origin_destination",
        legIndex: i,
        message: `The route for leg ${i + 1} looks like ${origin} → ${destination}. Where should you be flying to?`,
      };
    }
    if (!parseIsoDate(q.departureDate)) {
      return {
        ok: false,
        code: "invalid_departure_date",
        legIndex: i,
        message: "I need a valid departure date (YYYY-MM-DD) before I can search live flights.",
      };
    }
    if (q.returnDate && (!parseIsoDate(q.returnDate) || q.returnDate < q.departureDate)) {
      return {
        ok: false,
        code: "invalid_return_date",
        legIndex: i,
        message: "The return date must be on or after the outbound departure date.",
      };
    }
  }

  return { ok: true };
}

function parseFlightQuery(raw: unknown): FlightSearchQuery | null {
  if (!isRecord(raw)) return null;
  const origin = parseIata(raw.origin);
  const destination = parseIata(raw.destination);
  const departureDate = parseIsoDate(raw.departureDate);
  if (!origin || !destination || !departureDate) return null;
  if (origin === destination) return null;

  const query: FlightSearchQuery = { origin, destination, departureDate };

  // Soft: drop malformed returnDate instead of rejecting the whole leg.
  const returnDate = parseIsoDate(raw.returnDate);
  if (returnDate && returnDate >= departureDate) {
    query.returnDate = returnDate;
  }

  if (raw.passengers != null) {
    const passengers = asInt(raw.passengers, 1, 9);
    if (passengers != null) query.passengers = passengers;
  }

  if (raw.cabinClass != null) {
    const normalized = asString(raw.cabinClass)?.toUpperCase().replace(/\s+/g, "_");
    if (normalized) {
      const cabin = normalized as CabinClass;
      if (CABINS.has(cabin)) {
        query.cabinClass = cabin;
      } else if (normalized === "PREMIUM" || normalized === "PREMIUM-ECONOMY") {
        query.cabinClass = "PREMIUM_ECONOMY";
      }
    }
  }

  if (raw.requestedCurrency != null) {
    const cur = asString(raw.requestedCurrency);
    if (cur && cur.length === 3) query.requestedCurrency = cur.toUpperCase();
  }

  return query;
}

function parseHotelQuery(raw: unknown): HotelSearchQuery | null {
  if (!isRecord(raw)) return null;
  const cityRaw = asString(raw.cityCode) || asString(raw.city);
  if (!cityRaw) return null;
  const cityCode = (placeToIata(cityRaw) || cityRaw).toUpperCase();
  if (!/^[A-Z]{3}$/.test(cityCode)) return null;

  const checkInDate = parseIsoDate(raw.checkInDate);
  const checkOutDate = parseIsoDate(raw.checkOutDate);
  if (!checkInDate || !checkOutDate) return null;
  if (checkOutDate <= checkInDate) return null;

  const query: HotelSearchQuery = { cityCode, checkInDate, checkOutDate };

  if (raw.rooms != null) {
    const rooms = asInt(raw.rooms, 1, 10);
    if (rooms != null) query.rooms = rooms;
  }
  if (raw.guests != null) {
    const guests = asInt(raw.guests, 1, 20);
    if (guests != null) query.guests = guests;
  }
  if (raw.hotelName != null) {
    const hotelName = asString(raw.hotelName);
    if (hotelName && hotelName.length >= 2 && hotelName.length <= 80) {
      query.hotelName = hotelName;
    }
  }
  if (raw.requestedCurrency != null) {
    const cur = asString(raw.requestedCurrency);
    if (cur && cur.length === 3) query.requestedCurrency = cur.toUpperCase();
  }

  return query;
}

function parseSearchLeg(raw: unknown): SearchLeg | null {
  if (!isRecord(raw)) return null;
  const product = asString(raw.product)?.toUpperCase();
  if (product === "FLIGHT") {
    const query = parseFlightQuery(raw.query);
    if (!query) return null;
    return { product: "FLIGHT", query };
  }
  if (product === "HOTEL") {
    const query = parseHotelQuery(raw.query);
    if (!query) return null;
    return { product: "HOTEL", query };
  }
  return null;
}

const HHMM = /^\d{2}:\d{2}$/;

export function parseAirlineCodes(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const codes = raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{2}$/.test(c));
  return codes.length > 0 ? [...new Set(codes)].slice(0, 6) : undefined;
}

function parseFilters(raw: unknown): IntentFilters | undefined {
  if (!isRecord(raw)) return undefined;
  const filters: IntentFilters = {};
  if (raw.nonstopOnly === true) filters.nonstopOnly = true;
  if (raw.refundableOnly === true) filters.refundableOnly = true;
  if (raw.checkedBagRequired === true) filters.checkedBagRequired = true;
  if (raw.maxStops != null) {
    const maxStops = asInt(raw.maxStops, 0, 3);
    if (maxStops == null) return undefined;
    filters.maxStops = maxStops;
  }
  if (raw.maxLayoverMinutes != null) {
    const max = asInt(raw.maxLayoverMinutes, 15, 1440);
    if (max != null) filters.maxLayoverMinutes = max;
  }
  if (raw.departAfterLocal != null) {
    const t = asString(raw.departAfterLocal);
    if (t && HHMM.test(t)) filters.departAfterLocal = t;
  }
  if (raw.departBeforeLocal != null) {
    const t = asString(raw.departBeforeLocal);
    if (t && HHMM.test(t)) filters.departBeforeLocal = t;
  }
  if (raw.arriveBeforeLocal != null) {
    const t = asString(raw.arriveBeforeLocal);
    if (t && HHMM.test(t)) filters.arriveBeforeLocal = t;
  }
  const preferredAirlines = parseAirlineCodes(raw.preferredAirlines);
  if (preferredAirlines) filters.preferredAirlines = preferredAirlines;
  const airlinesOnly = parseAirlineCodes(raw.airlinesOnly);
  if (airlinesOnly) filters.airlinesOnly = airlinesOnly;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** Strip markdown fences and recover the first JSON object. */
export function parseJsonObject(text: string): unknown | null {
  let s = text.trim();
  // Strip BOM / smart quotes Gemma sometimes emits.
  s = s.replace(/^\uFEFF/, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const extracted = extractFirstJsonValue(s);
  if (!extracted) return null;

  const tryParse = (candidate: string): unknown | null => {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  };

  let direct = tryParse(extracted);
  if (direct != null) return direct;

  // Trailing commas before } or ].
  const noTrailingCommas = extracted.replace(/,\s*([}\]])/g, "$1");
  direct = tryParse(noTrailingCommas);
  if (direct != null) return direct;

  // Truncated object — close open braces/brackets.
  return tryParse(balanceJson(noTrailingCommas));
}

/** Slice the first top-level `{...}` (or `[...]`) from noisy LLM text. */
function extractFirstJsonValue(s: string): string | null {
  const startObj = s.indexOf("{");
  const startArr = s.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
    start = startObj;
  } else if (startArr >= 0) {
    start = startArr;
  } else {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  // Truncated — return remainder for balanceJson.
  return s.slice(start);
}

function balanceJson(s: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = s.trimEnd().replace(/,\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  return out;
}

/** Validate unknown LLM output into a TravelPlan, or null. */
export function parseTravelPlan(
  text: string,
  opts?: { today?: string },
): TravelPlan | null {
  const raw = parseJsonObject(text);
  if (!isRecord(raw)) return null;

  const coerced = coercePartialTravelPlanRaw(raw, opts?.today);
  const action = asString(coerced.action)?.toLowerCase();
  if (!action) return null;

  if (action === "close") return { action: "close" };
  if (action === "off_topic") return { action: "off_topic" };

  if (action === "clarify") {
    const ask = asString(coerced.ask);
    if (!ask) return null;
    const missing = Array.isArray(coerced.missing)
      ? coerced.missing.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];
    let draft: Extract<TravelPlan, { action: "search" }> | undefined;
    if (isRecord(coerced.draft) || Array.isArray(coerced.searches)) {
      const draftRaw = isRecord(coerced.draft)
        ? { action: "search", ...coerced.draft }
        : { action: "search", searches: coerced.searches, filters: coerced.filters };
      const parsedDraft = parseTravelPlan(JSON.stringify(draftRaw), opts);
      if (parsedDraft?.action === "search") draft = parsedDraft;
    }
    return { action: "clarify", missing, ask, ...(draft ? { draft } : {}) };
  }

  if (action === "package") {
    const origin = parseIata(coerced.origin);
    const destination = parseIata(coerced.destination);
    if (!origin || !destination || origin === destination) return null;
    const plan: Extract<TravelPlan, { action: "package" }> = {
      action: "package",
      origin,
      destination,
    };
    if (coerced.minStars != null) {
      const minStars = asInt(coerced.minStars, 1, 5);
      if (minStars == null) return null;
      plan.minStars = minStars;
    }
    if (coerced.departureDate != null) {
      const d = parseIsoDate(coerced.departureDate);
      if (!d) return null;
      plan.departureDate = d;
    }
    if (coerced.returnDate != null) {
      const d = parseIsoDate(coerced.returnDate);
      if (!d) return null;
      plan.returnDate = d;
    }
    if (coerced.passengers != null) {
      const passengers = asInt(coerced.passengers, 1, 9);
      if (passengers == null) return null;
      plan.passengers = passengers;
    }
    if (coerced.datesAssumed === true) plan.datesAssumed = true;
    return plan;
  }

  if (action !== "search") return null;

  let searches: SearchLeg[] = [];
  if (Array.isArray(coerced.searches)) {
    for (const item of coerced.searches.slice(0, MAX_SEARCH_LEGS)) {
      const leg = parseSearchLeg(item);
      // Skip junk legs — Gemma often mixes one bad hotel into an otherwise valid plan.
      if (leg) searches.push(leg);
    }
  } else {
    const legacy = parseSearchLeg(coerced);
    if (legacy) searches = [legacy];
  }
  if (searches.length === 0) return null;

  const filters = parseFilters(coerced.filters);
  return {
    action: "search",
    searches,
    ...(coerced.includePackages === true ? { includePackages: true } : {}),
    ...(coerced.datesAssumed === true ? { datesAssumed: true } : {}),
    ...(filters ? { filters } : {}),
  };
}

/**
 * Salvage common incomplete LLM plan shapes before schema validation:
 * - clarify without ask → synthesize a short ask
 * - multi-leg / datesAssumed search missing departureDate → fill ~today+21 chain
 */
export function coercePartialTravelPlanRaw(
  raw: Record<string, unknown>,
  today?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  const action = asString(out.action)?.toLowerCase();

  if (action === "clarify" && !asString(out.ask)) {
    const missing = Array.isArray(out.missing)
      ? out.missing.filter((m): m is string => typeof m === "string")
      : [];
    if (missing.includes("departureDate")) {
      out.ask = "What date would you like to depart?";
    } else if (missing.includes("destination")) {
      out.ask = "Where would you like to fly to?";
    } else if (missing.includes("origin")) {
      out.ask = "Where are you flying from?";
    } else {
      out.ask = "Could you share a bit more about your trip?";
    }
  }

  if (action === "search" && Array.isArray(out.searches) && today) {
    const legs = out.searches.filter(isRecord);
    const flightQueries = legs
      .filter((l) => asString(l.product)?.toUpperCase() === "FLIGHT" && isRecord(l.query))
      .map((l) => l.query as Record<string, unknown>);

    const missingDates = flightQueries.some(
      (q) => parseIata(q.origin) && parseIata(q.destination) && !parseIsoDate(q.departureDate),
    );
    const multiLeg = flightQueries.length >= 2;

    if (missingDates && (out.datesAssumed === true || multiLeg)) {
      out.datesAssumed = true;
      let cursor = addDaysIso(today, 21);
      for (const leg of legs) {
        if (asString(leg.product)?.toUpperCase() !== "FLIGHT" || !isRecord(leg.query)) continue;
        const q = { ...leg.query } as Record<string, unknown>;
        const origin = parseIata(q.origin);
        const destination = parseIata(q.destination);
        if (!origin || !destination) continue;
        if (!parseIsoDate(q.departureDate)) {
          q.departureDate = cursor;
          leg.query = q;
          cursor = addDaysIso(cursor, 3);
        } else {
          cursor = addDaysIso(String(q.departureDate), 3);
        }
      }
      out.searches = legs;
    }
  }

  return out;
}

function cabinFromSupplier(
  cabin?: CabinClass,
): ExtractedIntent["cabin"] | undefined {
  if (cabin === "BUSINESS") return "business";
  if (cabin === "PREMIUM_ECONOMY") return "premium";
  if (cabin === "ECONOMY" || cabin === "FIRST") return cabin === "FIRST" ? "business" : "economy";
  return undefined;
}

function maxPassengers(searches: SearchLeg[]): number | undefined {
  let max: number | undefined;
  for (const s of searches) {
    if (s.product === "FLIGHT" && s.query.passengers != null) {
      max = Math.max(max ?? 0, s.query.passengers);
    }
    if (s.product === "HOTEL" && s.query.guests != null) {
      max = Math.max(max ?? 0, s.query.guests);
    }
  }
  return max;
}

/** Map a validated plan into ExtractedIntent for API/UI compatibility. */
export function intentFromPlan(plan: TravelPlan): ExtractedIntent {
  if (plan.action === "off_topic") {
    return { offTopic: true };
  }
  if (plan.action === "close" || plan.action === "clarify") {
    if (plan.action === "clarify" && plan.draft) {
      return intentFromPlan(plan.draft);
    }
    return { offTopic: false };
  }

  if (plan.action === "package") {
    return {
      offTopic: false,
      type: "package",
      origin: iataToPlace(plan.origin),
      destination: iataToPlace(plan.destination),
      destinations: [iataToPlace(plan.destination)],
      minStars: plan.minStars,
      passengers: plan.passengers,
      departureDate: plan.departureDate,
      returnDate: plan.returnDate,
      datesAssumed: plan.datesAssumed,
    };
  }

  const flights = plan.searches.filter((s) => s.product === "FLIGHT");
  const hotels = plan.searches.filter((s) => s.product === "HOTEL");

  const destinations: string[] = [];
  const seen = new Set<string>();
  const pushDest = (place: string) => {
    if (seen.has(place)) return;
    seen.add(place);
    destinations.push(place);
  };

  for (const f of flights) {
    pushDest(iataToPlace(f.query.destination));
  }
  for (const h of hotels) {
    pushDest(iataToPlace(h.query.cityCode));
  }

  const firstFlight = flights[0];
  const firstHotel = hotels[0];
  const lastFlight = flights[flights.length - 1];

  const hasFlight = flights.length > 0;
  const hasHotel = hotels.length > 0;
  const type = plan.includePackages
    ? ("package" as const)
    : hasFlight && hasHotel
      ? undefined
      : hasFlight
        ? ("flight" as const)
        : hasHotel
          ? ("hotel" as const)
          : undefined;

  return {
    offTopic: false,
    type,
    origin: firstFlight ? iataToPlace(firstFlight.query.origin) : undefined,
    destination: destinations[destinations.length - 1],
    destinations,
    hotelName: firstHotel?.query.hotelName,
    cabin: cabinFromSupplier(firstFlight?.query.cabinClass),
    passengers: maxPassengers(plan.searches),
    departureDate:
      firstFlight?.query.departureDate ?? firstHotel?.query.checkInDate,
    returnDate:
      lastFlight?.query.returnDate ??
      hotels[hotels.length - 1]?.query.checkOutDate,
    datesAssumed: plan.datesAssumed,
    filters: plan.filters,
  };
}

/** Flight-shaped fields `applyIntentFilters` needs — subset of `FlightOffer`. */
export interface FilterableFlight {
  type: string;
  stops?: number;
  refundable?: boolean;
  airline?: string;
  baggageKg?: number;
  departTimeLocal?: string;
  segments?: { layoverMinutesAfter?: number }[];
}

/**
 * Apply refine filters to a flat offer list. `preferredAirlines` is soft
 * (see preferAirlineOffers) — only `airlinesOnly` hard-wipes non-matching carriers.
 * Any field we lack data for is left alone rather than false-dropping the offer.
 */
export function applyIntentFilters<T extends FilterableFlight>(
  offers: T[],
  filters?: IntentFilters,
): T[] {
  if (!filters) return offers;
  return offers.filter((o) => {
    if (o.type !== "flight") {
      return !filters.refundableOnly || o.refundable !== false;
    }
    const stops = o.stops ?? 0;
    if (filters.nonstopOnly && stops > 0) return false;
    if (filters.maxStops != null && stops > filters.maxStops) return false;
    if (filters.refundableOnly && o.refundable === false) return false;

    if (filters.maxLayoverMinutes != null && o.segments?.length) {
      const overLong = o.segments.some(
        (s) => (s.layoverMinutesAfter ?? 0) > filters.maxLayoverMinutes!,
      );
      if (overLong) return false;
    }

    if (o.departTimeLocal) {
      if (filters.departAfterLocal && o.departTimeLocal < filters.departAfterLocal) {
        return false;
      }
      if (filters.departBeforeLocal && o.departTimeLocal > filters.departBeforeLocal) {
        return false;
      }
    }

    if (filters.checkedBagRequired && o.baggageKg === 0) return false;

    if (filters.airlinesOnly?.length) {
      if (!o.airline || !airlineMatchesPreference(o.airline, filters.airlinesOnly)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Soft-rank preferred airlines first. If none match, leave the list unchanged
 * (never blank the board for "Qatar" when Travelport returned other carriers).
 */
/**
 * Keep flight/package headcount honest: stay length ("for 4 nights") must not
 * inflate passengers. Prefer explicit party phrases from chat; otherwise force 1.
 */
export function guardPlanPassengers(
  plan: TravelPlan,
  message: string,
  history: ChatTurn[] = [],
): TravelPlan {
  const party = extractIntent(message, history).passengers;

  if (plan.action === "search") {
    return {
      ...plan,
      searches: plan.searches.map((s) => {
        if (s.product === "FLIGHT") {
          return {
            ...s,
            query: { ...s.query, passengers: party ?? 1 },
          };
        }
        if (s.product === "HOTEL" && party != null) {
          return {
            ...s,
            query: {
              ...s.query,
              guests: Math.max(party, s.query.guests ?? 2),
            },
          };
        }
        return s;
      }),
    };
  }

  if (plan.action === "package") {
    return { ...plan, passengers: party ?? 1 };
  }

  return plan;
}

/** Stopover / mixed-carrier return / open-jaw — never a single RT GDS search. */
export function isComplexReturnAsk(message: string): boolean {
  if (
    /\b(layover|lay[\s-]?over|stopover|stop[\s-]?over|open[\s-]?jaw|multi[\s-]?city)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\bvia\s+[A-Za-z]{3,}\b/i.test(message)) return true;
  // Leisure multi-stop: "stay … then … then back"
  if (
    /\bthen\s+back\b/i.test(message) ||
    /\bback\s+to\b/i.test(message) ||
    /\breturn\s+(?:via|through|layover)\b/i.test(message)
  ) {
    return true;
  }
  // Outbound carrier A + explicit return on carrier B.
  const prefs = extractPreferredAirlines(message);
  if (prefs.length >= 2 && /\breturn\b/i.test(message)) return true;
  return false;
}

function layoverDaysFromMessage(message: string, fallback = 2): number {
  const m =
    message.match(
      /\blayover\s+(?:in|at)\s+[A-Za-z][A-Za-z\s]{0,24}?\s+for\s+(\d{1,2})\s*(?:nights?|days?)\b/i,
    ) ||
    message.match(
      /\b(?:layover|stopover|stop[\s-]?over)\s+for\s+(\d{1,2})\s*(?:nights?|days?)\b/i,
    ) ||
    message.match(/\b(\d{1,2})\s*(?:nights?|days?)\s+(?:layover|stopover|stop[\s-]?over)\b/i) ||
    message.match(/\b(\d{1,2})\s*day(?:s)?\s+layover\b/i) ||
    message.match(/\blayover\s+(?:of\s+)?(\d{1,2})\s*day/i) ||
    message.match(/\b(\d{1,2})\s*day(?:s)?\s+(?:in|at)\s+(?:madinah|medina|bangkok)\b/i);
  if (!m) return fallback;
  return Math.min(14, Math.max(1, Number(m[1])));
}

function stopoverIata(message: string): string | null {
  if (/\b(madinah|medina)\b/i.test(message)) return "MED";
  if (/\bjeddah\b/i.test(message)) return "JED";
  if (/\bdoha\b/i.test(message)) return "DOH";
  if (/\bbangkok\b|\bthailand\b/i.test(message) &&
      /\b(layover|stopover|via|then|return)\b/i.test(message)) {
    return "BKK";
  }
  if (/\bdubai\b/i.test(message) && /\b(layover|stopover|via)\b/i.test(message)) {
    return "DXB";
  }
  const inCity = message.match(
    /\b(?:layover|stopover|stop[\s-]?over)\s+(?:in|at)\s+([A-Za-z][A-Za-z\s]{1,24}?)(?:\s+for\b|[.,!]|$)/i,
  );
  if (inCity) return placeToIata(inCity[1].trim());
  const via = message.match(/\bvia\s+([A-Za-z][A-Za-z\s]{1,20}?)\b/i);
  if (via) return placeToIata(via[1].trim());
  return null;
}

function withoutReturnDate(q: FlightSearchQuery): FlightSearchQuery {
  const { returnDate: _r, ...rest } = q;
  return rest;
}

function stripFlightReturnDates(legs: SearchLeg[]): SearchLeg[] {
  return legs.map((s) =>
    s.product === "FLIGHT" ? { ...s, query: withoutReturnDate(s.query) } : s,
  );
}

function wantsReturnHome(message: string): boolean {
  return (
    /\bthen\s+back\b/i.test(message) ||
    /\bback\s+to\b/i.test(message) ||
    /\breturn\s+(?:home|to)\b/i.test(message) ||
    /\bhome\b/i.test(message) ||
    isComplexReturnAsk(message)
  );
}

/**
 * If the flight chain never lands at the trip origin (or "back to" city),
 * append a final one-way home. Fixes LLM plans that only emit outbound + first stopover.
 */
export function ensureReturnHomeLeg(plan: TravelPlan, message: string): TravelPlan {
  if (plan.action !== "search") return plan;
  if (!wantsReturnHome(message)) return plan;

  const flightLegs = plan.searches.filter((s) => s.product === "FLIGHT");
  const otherLegs = plan.searches.filter((s) => s.product !== "FLIGHT");
  if (flightLegs.length === 0) return plan;

  const first = flightLegs[0];
  const last = flightLegs[flightLegs.length - 1];
  if (first.product !== "FLIGHT" || last.product !== "FLIGHT") return plan;

  const home = first.query.origin.toUpperCase();
  const lastDest = last.query.destination.toUpperCase();
  if (lastDest === home) {
    return {
      ...plan,
      searches: [...stripFlightReturnDates(flightLegs), ...otherLegs],
    };
  }

  // Prefer explicit "back to {city}" over outbound origin when present.
  let homeIata = home;
  const backTo = message.match(/\bback\s+to\s+([A-Za-z][A-Za-z\s]{1,20}?)\b/i);
  if (backTo) {
    const coded = placeToIata(backTo[1].trim());
    if (coded) homeIata = coded;
  }
  if (lastDest === homeIata) {
    return {
      ...plan,
      searches: [...stripFlightReturnDates(flightLegs), ...otherLegs],
    };
  }

  const nights = layoverDaysFromMessage(message, 2);
  const departHome = addDaysIso(last.query.departureDate, nights);
  const template = last.query;

  const homeLeg: SearchLeg = {
    product: "FLIGHT",
    query: {
      origin: lastDest,
      destination: homeIata,
      departureDate: departHome,
      passengers: template.passengers,
      cabinClass: template.cabinClass,
      requestedCurrency: template.requestedCurrency,
    },
  };

  return {
    ...plan,
    searches: [...stripFlightReturnDates(flightLegs), homeLeg, ...otherLegs],
  };
}

/**
 * Complex returns (layover / different return airline) → separate one-way legs.
 * Simple overnight stays keep a single RT search (labelled on the card).
 */
export function splitComplexReturnPlan(plan: TravelPlan, message: string): TravelPlan {
  if (plan.action !== "search") return plan;
  if (!isComplexReturnAsk(message)) return plan;

  const flightLegs = plan.searches.filter((s) => s.product === "FLIGHT");
  const otherLegs = plan.searches.filter((s) => s.product !== "FLIGHT");

  // Already multi-leg — strip RT dates, then ensure we still fly home.
  if (flightLegs.length >= 2) {
    return ensureReturnHomeLeg(
      {
        ...plan,
        searches: [...stripFlightReturnDates(flightLegs), ...otherLegs],
      },
      message,
    );
  }

  const only = flightLegs[0];
  if (!only || only.product !== "FLIGHT") return plan;
  const q = only.query;
  if (!q.returnDate) {
    // Single OW but message asks for layover home — expand if we can infer stop.
    const stop = stopoverIata(message);
    if (!stop || stop === q.origin || stop === q.destination) {
      return ensureReturnHomeLeg(plan, message);
    }
    // Need a leave-destination date: primary stay nights after outbound.
    const stayNights = primaryStayNights(message, 4);
    const leaveDest = addDaysIso(q.departureDate, stayNights);
    const days = layoverDaysFromMessage(message);
    const out: SearchLeg[] = [
      { product: "FLIGHT", query: withoutReturnDate(q) },
      {
        product: "FLIGHT",
        query: {
          origin: q.destination,
          destination: stop,
          departureDate: leaveDest,
          passengers: q.passengers,
          cabinClass: q.cabinClass,
          requestedCurrency: q.requestedCurrency,
        },
      },
      {
        product: "FLIGHT",
        query: {
          origin: stop,
          destination: q.origin,
          departureDate: addDaysIso(leaveDest, days),
          passengers: q.passengers,
          cabinClass: q.cabinClass,
          requestedCurrency: q.requestedCurrency,
        },
      },
    ];
    return { ...plan, searches: [...out, ...otherLegs] };
  }

  const stop = stopoverIata(message);
  const out: SearchLeg[] = [
    {
      product: "FLIGHT",
      query: withoutReturnDate(q),
    },
  ];

  if (stop && stop !== q.origin && stop !== q.destination) {
    const days = layoverDaysFromMessage(message);
    out.push({
      product: "FLIGHT",
      query: {
        origin: q.destination,
        destination: stop,
        departureDate: q.returnDate,
        passengers: q.passengers,
        cabinClass: q.cabinClass,
        requestedCurrency: q.requestedCurrency,
      },
    });
    out.push({
      product: "FLIGHT",
      query: {
        origin: stop,
        destination: q.origin,
        departureDate: addDaysIso(q.returnDate, days),
        passengers: q.passengers,
        cabinClass: q.cabinClass,
        requestedCurrency: q.requestedCurrency,
      },
    });
  } else {
    // Mixed-airline return without a named stop — OW home on returnDate.
    out.push({
      product: "FLIGHT",
      query: {
        origin: q.destination,
        destination: q.origin,
        departureDate: q.returnDate,
        passengers: q.passengers,
        cabinClass: q.cabinClass,
        requestedCurrency: q.requestedCurrency,
      },
    });
  }

  return { ...plan, searches: [...out, ...otherLegs] };
}

/** Primary leisure stay nights ("stay there for 4 nights") — not the layover nights. */
function primaryStayNights(message: string, fallback = 4): number {
  const stay = message.match(
    /\bstay(?:\s+\w+){0,4}\s+for\s+(\d{1,2})\s*nights?\b/i,
  );
  if (stay) return Math.min(21, Math.max(1, Number(stay[1])));
  // First "for N nights" before a layover mention.
  const beforeLay =
    message.split(/\blayover\b|\bstopover\b/i)[0]?.match(/\bfor\s+(\d{1,2})\s*nights?\b/i) ??
    null;
  if (beforeLay) return Math.min(21, Math.max(1, Number(beforeLay[1])));
  return fallback;
}

export function preferAirlineOffers<T extends { type: string; airline?: string }>(
  offers: T[],
  preferredAirlines?: string[],
): T[] {
  if (!preferredAirlines?.length || offers.length === 0) return offers;
  const preferred: T[] = [];
  const rest: T[] = [];
  for (const o of offers) {
    if (
      o.type === "flight" &&
      typeof o.airline === "string" &&
      airlineMatchesPreference(o.airline, preferredAirlines)
    ) {
      preferred.push(o);
    } else {
      rest.push(o);
    }
  }
  if (preferred.length === 0) return offers;
  return [...preferred, ...rest];
}

/** Soft-rank: nonstops first (time-saving pitch) without dropping connecting options. */
export function preferNonstopOffers<T extends { type: string; stops?: number }>(
  offers: T[],
): T[] {
  if (offers.length === 0) return offers;
  const nonstop: T[] = [];
  const rest: T[] = [];
  for (const o of offers) {
    if (o.type === "flight" && o.stops === 0) nonstop.push(o);
    else rest.push(o);
  }
  if (nonstop.length === 0) return offers;
  return [...nonstop, ...rest];
}

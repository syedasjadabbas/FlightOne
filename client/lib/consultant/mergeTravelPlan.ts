/**
 * Multi-turn travel-plan continuity.
 *
 * Merges previous conversation state + latest extraction + Ava's last question
 * so short replies ("yes", "one way", "September 15") never wipe known slots.
 */
import { resolvePlaceOrIata } from "@/lib/inventory/places";
import type { ChatTurn } from "@/lib/llm";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";
import { extractFlightRouteFromMessage } from "./extractFlightRoute";
import {
  midpointOfVagueBand,
  parseFlightDatesFromMessage,
  type VagueDateBand,
} from "./parseFlightDates";
import { extractIntent, parsePassengers } from "./intent";
import {
  validateSearchPlan,
  type TravelPlan,
} from "./travelPlan";
import {
  extractExplicitSlotOverrides,
  extractLeadingCityDestination,
  logTravelPlanDebug,
} from "./slotOverrides";

export type SearchTravelPlan = Extract<TravelPlan, { action: "search" }>;
export type ClarifyTravelPlan = Extract<TravelPlan, { action: "clarify" }>;

export type MergeTravelPlanCtx = {
  message: string;
  history: ChatTurn[];
  today: string;
  defaultOriginIata: string;
  defaultOriginPlace: string;
  /** Plan returned on the previous turn (draft or search). */
  previousPlan?: TravelPlan | null;
};

const AFFIRM =
  /^(yes|yep|yeah|yup|sure|ok|okay|please|correct|right|confirm|confirmed|do it|go ahead|sounds good|that'?s fine|ye)$/i;
const NEGATE = /^(no|nope|nah|not really|cancel|never ?mind)$/i;
const ONE_WAY = /\b(one[\s-]?way|ow|single)\b/i;
const ROUND_TRIP = /\b(round[\s-]?trip|return|rt|two[\s-]?way)\b/i;
const NEARBY = /\b(nearby|alternate|alternative)\s+airport/i;
const TRIP_TYPE_Q = /\b(one[\s-]?way|round[\s-]?trip|return)\b/i;
const RETURN_DATE_Q = /\b(return|coming back|fly back|homebound)\b/i;
const DEPART_DATE_Q = /\b(when|what date|depart|departure|fly)\b/i;
const DEST_Q = /\b(where|destination|fly to|going)\b/i;
const ORIGIN_Q = /\b(where.*from|leaving from|depart from|origin)\b/i;
const PASSENGERS_Q = /\b(how many|passenger|traveller|traveler|people|adults?)\b/i;
const CABIN_Q = /\b(cabin|class|economy|business|premium)\b/i;
const NONSTOP_Q = /\b(nonstop|non-stop|direct only|without stops)\b/i;

/** Structured slot Ava is clarifying — prefer `missing[]` over ask text. */
export type ClarificationSlot =
  | "origin"
  | "destination"
  | "departureDate"
  | "returnDate"
  | "tripType"
  | "passengers"
  | "cabin"
  | "nearbyAirports"
  | "nonstop"
  | "other";

export function normalizeMissingSlot(m: string): ClarificationSlot {
  const key = m.toLowerCase();
  if (key.includes("origin")) return "origin";
  if (key.includes("destination")) return "destination";
  if (key.includes("departure")) return "departureDate";
  if (key.includes("return")) return "returnDate";
  if (key.includes("trip")) return "tripType";
  if (key.includes("passenger") || key.includes("traveller") || key.includes("traveler")) {
    return "passengers";
  }
  if (key.includes("cabin")) return "cabin";
  if (key.includes("nearby")) return "nearbyAirports";
  if (key.includes("nonstop") || key.includes("stop")) return "nonstop";
  return "other";
}

function isBooleanClarificationSlot(slot: ClarificationSlot): boolean {
  return slot === "tripType" || slot === "nearbyAirports" || slot === "nonstop";
}

/** Yes/no only applies when the prior question is genuinely boolean. */
export function isBooleanYesNoQuestion(ask: string, slot: ClarificationSlot): boolean {
  if (slot === "nearbyAirports") {
    return NEARBY.test(ask) && /\b(would you|want|include|prefer)\b/i.test(ask);
  }
  if (slot === "nonstop") {
    return NONSTOP_Q.test(ask) && /\b(would you|want|prefer|only)\b/i.test(ask);
  }
  if (slot === "tripType") {
    if (/\bor\b/i.test(ask)) return false;
    return TRIP_TYPE_Q.test(ask) && /\b(would you|want|prefer)\b/i.test(ask);
  }
  return false;
}

/** Resolve which slot the conversation is waiting on. */
export function clarificationSlotFromContext(
  previousPlan: TravelPlan | null | undefined,
  ask: string | null,
): ClarificationSlot | null {
  if (previousPlan?.action === "clarify" && previousPlan.missing.length > 0) {
    return normalizeMissingSlot(previousPlan.missing[0]);
  }
  if (!ask) return null;
  if (TRIP_TYPE_Q.test(ask) && /\b(would you|want|prefer)\b/i.test(ask)) return "tripType";
  if (NEARBY.test(ask)) return "nearbyAirports";
  if (NONSTOP_Q.test(ask) && /\b(would you|want|prefer)\b/i.test(ask)) return "nonstop";
  // Return-date asks often start with "When" — classify return before generic depart/when.
  if (RETURN_DATE_Q.test(ask)) return "returnDate";
  if (DEPART_DATE_Q.test(ask)) return "departureDate";
  if (DEST_Q.test(ask)) return "destination";
  if (ORIGIN_Q.test(ask)) return "origin";
  if (PASSENGERS_Q.test(ask)) return "passengers";
  if (CABIN_Q.test(ask)) return "cabin";
  return null;
}

function isAffirmative(text: string): boolean {
  return AFFIRM.test(text.trim());
}

function isNegative(text: string): boolean {
  return NEGATE.test(text.trim());
}

function lastAssistantAsk(history: ChatTurn[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t?.role === "assistant" && t.content.trim()) return t.content.trim();
  }
  return null;
}

function flightQueryFromPlan(plan: TravelPlan | null | undefined): FlightSearchQuery | null {
  if (!plan) return null;
  if (plan.action === "search") {
    const leg = plan.searches.find((s) => s.product === "FLIGHT");
    return leg?.product === "FLIGHT" ? { ...leg.query } : null;
  }
  if (plan.action === "clarify" && plan.draft) {
    const leg = plan.draft.searches.find((s) => s.product === "FLIGHT");
    return leg?.product === "FLIGHT" ? { ...leg.query } : null;
  }
  if (plan.action === "package") {
    return {
      origin: plan.origin,
      destination: plan.destination,
      departureDate: plan.departureDate || "",
      ...(plan.returnDate ? { returnDate: plan.returnDate } : {}),
      ...(plan.passengers != null ? { passengers: plan.passengers } : {}),
    };
  }
  return null;
}

function filtersFromPlan(plan: TravelPlan | null | undefined) {
  if (!plan) return undefined;
  if (plan.action === "search") return plan.filters;
  if (plan.action === "clarify") return plan.draft?.filters;
  return undefined;
}

function asSearchPlan(
  query: FlightSearchQuery,
  filters?: SearchTravelPlan["filters"],
  datesAssumed?: boolean,
): SearchTravelPlan {
  return {
    action: "search",
    searches: [{ product: "FLIGHT", query }],
    ...(filters ? { filters } : {}),
    ...(datesAssumed ? { datesAssumed: true } : {}),
  };
}

function mergeFlightQueries(
  base: FlightSearchQuery | null,
  patch: FlightSearchQuery | null,
): FlightSearchQuery | null {
  if (!base && !patch) return null;
  if (!base) return patch ? { ...patch } : null;
  if (!patch) return { ...base };

  const merged: FlightSearchQuery = { ...base };
  if (patch.origin) merged.origin = patch.origin;
  if (patch.destination) merged.destination = patch.destination;
  if (patch.departureDate) merged.departureDate = patch.departureDate;
  if (patch.returnDate) merged.returnDate = patch.returnDate;
  if (patch.passengers != null) merged.passengers = patch.passengers;
  if (patch.cabinClass) merged.cabinClass = patch.cabinClass;
  if (patch.preferredCarriers?.length) merged.preferredCarriers = patch.preferredCarriers;
  if (patch.requestedCurrency) merged.requestedCurrency = patch.requestedCurrency;

  // Explicit one-way: remove return if patch has departure but no return and message said one-way
  return merged;
}

function missingSlotsForFlight(
  q: FlightSearchQuery | null,
  opts?: { wantRoundTrip?: boolean },
): string[] {
  const missing: string[] = [];
  if (!q?.origin) missing.push("origin");
  if (!q?.destination) missing.push("destination");
  if (!q?.departureDate) missing.push("departureDate");
  if (opts?.wantRoundTrip && q && !q.returnDate) missing.push("returnDate");
  return missing;
}

/**
 * Blocking slots only — passengers/cabin/airline are optional defaults.
 * Round-trip requires returnDate once trip type is known to be round trip.
 */
export function getMissingRequiredSlots(
  q: FlightSearchQuery | null,
  opts?: { wantRoundTrip?: boolean },
): string[] {
  return missingSlotsForFlight(q, opts);
}

function clarifyAskFor(missing: string[], q: FlightSearchQuery | null): string {
  if (missing.includes("destination") && !q?.destination) {
    return "Where would you like to fly to?";
  }
  if (missing.includes("origin") && !q?.origin) {
    return "Where are you flying from?";
  }
  if (missing.includes("departureDate") && !q?.departureDate) {
    return "What date would you like to depart?";
  }
  if (missing.includes("returnDate")) {
    return "When would you like to return?";
  }
  if (missing.includes("tripType")) {
    return "Would you like a one-way or round trip?";
  }
  return "Could you share a bit more about your trip?";
}

/** Follow-up wording when the user gave an invalid or unhelpful reply for a slot. */
export function retryClarifyAskFor(
  slot: ClarificationSlot,
  _q: FlightSearchQuery | null,
): string {
  switch (slot) {
    case "departureDate":
      return "Sure. What date would you like to depart?";
    case "returnDate":
      return "What date would you like to return?";
    case "destination":
      return "Which city or airport would you like to fly to?";
    case "origin":
      return "Which city are you departing from?";
    case "passengers":
      return "How many travellers will be flying?";
    case "cabin":
      return "Which cabin would you prefer — economy, premium, or business?";
    case "tripType":
      return "Would you like a one-way or round trip?";
    case "nearbyAirports":
      return "Would you like nearby airports included in the search?";
    case "nonstop":
      return "Would you like nonstop flights only?";
    default:
      return "Could you share a bit more detail about your trip?";
  }
}

const HARD_DEPART_ASK =
  "I need a departure date before I search. For example, September 10.";
const EXAMPLE_DEPART_ASK =
  "What departure date would you like? For example, September 10.";
const HARD_RETURN_ASK =
  "I need a return date before I search. For example, September 15.";
const EXAMPLE_RETURN_ASK =
  "What return date works for you? For example, September 15.";

function clarifyEscalationLevel(previousAsk: string | null | undefined): 0 | 1 | 2 | 3 {
  if (!previousAsk) return 0;
  const p = previousAsk.trim();
  if (p === HARD_DEPART_ASK || p === HARD_RETURN_ASK) return 3;
  if (p === EXAMPLE_DEPART_ASK || p === EXAMPLE_RETURN_ASK) return 2;
  if (
    p === retryClarifyAskFor("departureDate", null) ||
    p === retryClarifyAskFor("returnDate", null) ||
    /^sure\./i.test(p)
  ) {
    return 1;
  }
  if (/date|depart|return|when would you like to fly/i.test(p)) return 1;
  return 0;
}

function buildClarifyAsk(
  missing: string[],
  q: FlightSearchQuery | null,
  opts: {
    invalidAnswer?: boolean;
    previousAsk?: string | null;
    slot?: ClarificationSlot | null;
    vagueLabel?: string | null;
  },
): string {
  const primarySlot = normalizeMissingSlot(missing[0] ?? "other");

  if (opts.vagueLabel && primarySlot === "departureDate") {
    return `Do you have a specific date, or should I search around ${opts.vagueLabel}?`;
  }

  const initialAsk = clarifyAskFor(missing, q);
  const level = clarifyEscalationLevel(opts.previousAsk);

  if (opts.invalidAnswer || level > 0) {
    if (primarySlot === "departureDate") {
      if (level >= 2) return HARD_DEPART_ASK;
      if (level >= 1 || opts.invalidAnswer) return EXAMPLE_DEPART_ASK;
      return retryClarifyAskFor("departureDate", q);
    }
    if (primarySlot === "returnDate") {
      if (level >= 2) return HARD_RETURN_ASK;
      if (level >= 1 || opts.invalidAnswer) return EXAMPLE_RETURN_ASK;
      return retryClarifyAskFor("returnDate", q);
    }
    return retryClarifyAskFor(primarySlot, q);
  }

  return initialAsk;
}

function makeClarify(
  missing: string[],
  ask: string,
  draft: SearchTravelPlan | null,
): ClarifyTravelPlan {
  return {
    action: "clarify",
    missing,
    ask,
    ...(draft ? { draft } : {}),
  };
}

/** Build a draft search plan from chat history when structured previousPlan is missing. */
export function draftPlanFromHistory(
  history: ChatTurn[],
  opts: {
    today: string;
    defaultOriginIata: string;
    defaultOriginPlace: string;
  },
): SearchTravelPlan | null {
  const userText = history
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join("\n");
  if (!userText.trim()) return null;

  const route = extractFlightRouteFromMessage(userText, {
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
  });
  const dates = parseFlightDatesFromMessage(userText, opts.today);
  const intent = extractIntent(userText, [], { defaultOrigin: opts.defaultOriginPlace });
  const passengers = parsePassengers(userText) ?? intent.passengers ?? 1;

  if (!route && !dates?.departureDate && !intent.destination) return null;

  const query: FlightSearchQuery = {
    origin: route?.origin || opts.defaultOriginIata,
    destination: route?.destination || "",
    departureDate: dates?.departureDate || "",
    ...(dates?.returnDate ? { returnDate: dates.returnDate } : {}),
    passengers: Math.min(9, Math.max(1, passengers)),
  };

  if (!query.destination) {
    // Intent may have place name destination — leave empty, merge will clarify
    return asSearchPlan(query, intent.filters, dates?.yearInferred);
  }

  return asSearchPlan(query, intent.filters, dates?.yearInferred);
}

/**
 * Apply a short reply against Ava's previous question onto a base flight query.
 * Returns null when the message is not a short contextual answer.
 */
export function applyQuestionAwareReply(
  message: string,
  ask: string | null,
  base: FlightSearchQuery | null,
  opts: { today: string; defaultOriginIata: string; defaultOriginPlace: string },
  slot?: ClarificationSlot | null,
): {
  query: FlightSearchQuery | null;
  handled: boolean;
  invalidAnswer?: boolean;
  wantRoundTrip?: boolean;
  wantOneWay?: boolean;
  nearby?: boolean;
  vagueBand?: VagueDateBand;
  acceptVagueSearch?: boolean;
  datesAssumed?: boolean;
} {
  const text = message.trim();
  if (!text) return { query: base, handled: false };

  const q = base ? { ...base } : null;
  let handled = false;
  let invalidAnswer = false;
  let wantRoundTrip: boolean | undefined;
  let wantOneWay: boolean | undefined;
  let nearby: boolean | undefined;
  let vagueBand: VagueDateBand | undefined;
  let acceptVagueSearch: boolean | undefined;
  let datesAssumed: boolean | undefined;

  const activeSlot = slot ?? (ask ? clarificationSlotFromContext(null, ask) : null);

  // Affirmative to "search around mid-September?" → accept midpoint
  if (
    ask &&
    isAffirmative(text) &&
    /search around/i.test(ask) &&
    activeSlot === "departureDate"
  ) {
    const around = ask.match(/search around\s+(.+?)\?/i);
    const label = around?.[1]?.trim();
    if (label) {
      const fromLabel = parseFlightDatesFromMessage(label.replace(/^mid-/i, "mid "), opts.today);
      if (fromLabel?.vague) {
        handled = true;
        acceptVagueSearch = true;
        const next = q ?? {
          origin: opts.defaultOriginIata,
          destination: "",
          departureDate: "",
          passengers: 1,
        };
        next.departureDate = midpointOfVagueBand(fromLabel.vague);
        datesAssumed = true;
        return {
          query: next,
          handled,
          wantRoundTrip,
          wantOneWay,
          nearby,
          vagueBand: fromLabel.vague,
          acceptVagueSearch,
          datesAssumed,
        };
      }
    }
  }

  // Trip type from message itself
  if (ONE_WAY.test(text) && text.length < 40) {
    wantOneWay = true;
    handled = true;
    if (q) delete q.returnDate;
  } else if (ROUND_TRIP.test(text) && text.length < 40 && !/\bfrom\b/i.test(text)) {
    wantRoundTrip = true;
    handled = true;
  }

  // Affirmative / negative — only valid for boolean yes/no questions
  if (ask && (isAffirmative(text) || isNegative(text))) {
    const boolQuestion =
      activeSlot != null &&
      isBooleanClarificationSlot(activeSlot) &&
      isBooleanYesNoQuestion(ask, activeSlot);

    if (boolQuestion) {
      handled = true;
      if (isAffirmative(text)) {
        if (activeSlot === "tripType" && /round|return/i.test(ask)) {
          wantRoundTrip = true;
        } else if (activeSlot === "tripType" && /one[\s-]?way/i.test(ask)) {
          wantOneWay = true;
          if (q) delete q.returnDate;
        } else if (activeSlot === "nearbyAirports") {
          nearby = true;
        }
      } else if (isNegative(text)) {
        if (activeSlot === "tripType" && /round|return/i.test(ask)) {
          wantOneWay = true;
          if (q) delete q.returnDate;
        } else if (activeSlot === "nearbyAirports") {
          nearby = false;
        }
      }
    } else if (activeSlot != null && !isBooleanClarificationSlot(activeSlot)) {
      invalidAnswer = true;
      return {
        query: q,
        handled: false,
        invalidAnswer,
        wantRoundTrip,
        wantOneWay,
        nearby,
      };
    }
  }

  // Destination-only / origin-only short replies
  const route = extractFlightRouteFromMessage(text, {
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
  });
  if (route) {
    // Full route phrases overwrite; single-city replies must not clobber known slots
    // with defaultOrigin when the extractor filled it in.
    const looksLikeFullRoute =
      /\bfrom\b/i.test(text) ||
      /\bto\b/i.test(text) ||
      /[A-Za-z]{3}\s*(?:→|->)/.test(text);
    handled = true;
    const next = q ?? {
      origin: route.origin,
      destination: route.destination,
      departureDate: "",
      passengers: 1,
    };
    if (looksLikeFullRoute) {
      next.origin = route.origin;
      next.destination = route.destination;
    } else if (ask && ORIGIN_Q.test(ask)) {
      const named = resolvePlaceOrIata(text);
      next.origin = named || route.destination || route.origin;
    } else if (
      activeSlot === "destination" ||
      (ask && DEST_Q.test(ask)) ||
      // "beijing on 10 sept" — city+date reply must replace stale DXB even without DEST_Q ask
      Boolean(extractLeadingCityDestination(text))
    ) {
      next.destination = route.destination;
    } else {
      if (!next.destination) next.destination = route.destination;
      if (!next.origin) next.origin = route.origin;
    }
    // Apply explicit date in the same short reply ("beijing on 10 sept")
    const datesInRouteReply = parseFlightDatesFromMessage(text, opts.today);
    if (datesInRouteReply?.departureDate && activeSlot !== "returnDate") {
      next.departureDate = datesInRouteReply.departureDate;
    }
    if (datesInRouteReply?.returnDate) {
      next.returnDate = datesInRouteReply.returnDate;
    }
    return { query: next, handled, wantRoundTrip, wantOneWay, nearby };
  }

  // Single place answering destination/origin question OR replacing destination
  const placeIata = resolvePlaceOrIata(text) || extractLeadingCityDestination(text);
  if (placeIata && text.length < 60) {
    if (ask && ORIGIN_Q.test(ask)) {
      handled = true;
      const next = q ?? {
        origin: placeIata,
        destination: "",
        departureDate: "",
        passengers: 1,
      };
      next.origin = placeIata;
      return { query: next, handled, wantRoundTrip, wantOneWay, nearby };
    }
    if (
      activeSlot === "destination" ||
      (ask && DEST_Q.test(ask)) ||
      /\b(instead|actually|rather|change(?:\s+(?:the|my))?\s+destination)\b/i.test(text) ||
      Boolean(extractLeadingCityDestination(text))
    ) {
      handled = true;
      const next = q ?? {
        origin: opts.defaultOriginIata,
        destination: placeIata,
        departureDate: "",
        passengers: 1,
      };
      next.destination = placeIata;
      const datesWithPlace = parseFlightDatesFromMessage(text, opts.today);
      if (datesWithPlace?.departureDate && activeSlot !== "returnDate") {
        next.departureDate = datesWithPlace.departureDate;
      }
      return { query: next, handled, wantRoundTrip, wantOneWay, nearby };
    }
    // No ask but we have previous query missing destination
    if (q && !q.destination) {
      handled = true;
      q.destination = placeIata;
      return { query: q, handled, wantRoundTrip, wantOneWay, nearby };
    }
    if (q && !q.origin) {
      handled = true;
      q.origin = placeIata;
      return { query: q, handled, wantRoundTrip, wantOneWay, nearby };
    }
  }

  // Date reply — latest explicit departure always overrides previous departure
  // (except when Ava specifically asked for a return date).
  const dates = parseFlightDatesFromMessage(text, opts.today);
  if (dates?.vague && !dates.departureDate) {
    handled = true;
    vagueBand = dates.vague;
    return {
      query: q,
      handled,
      wantRoundTrip,
      wantOneWay,
      nearby,
      vagueBand,
    };
  }
  if (dates?.departureDate || dates?.returnDate) {
    handled = true;
    const next = q ?? {
      origin: opts.defaultOriginIata,
      destination: "",
      departureDate: "",
      passengers: 1,
    };
    const returnOnly =
      activeSlot === "returnDate" ||
      (Boolean(ask) && RETURN_DATE_Q.test(ask!) && !/\b(depart|departure|outbound)\b/i.test(ask!));
    if (returnOnly) {
      const ret = dates.returnDate || dates.departureDate;
      if (ret) next.returnDate = ret;
    } else {
      if (dates.departureDate) next.departureDate = dates.departureDate;
      if (dates.returnDate) next.returnDate = dates.returnDate;
    }
    return {
      query: next,
      handled,
      wantRoundTrip,
      wantOneWay,
      nearby,
      datesAssumed: dates.yearInferred,
    };
  }

  // Cabin / passengers short replies
  const passengers = parsePassengers(text);
  if (passengers != null && q) {
    handled = true;
    q.passengers = passengers;
  }

  if (
    (activeSlot === "cabin" || /\b(business|premium|economy|first)\s*(class)?\b/i.test(text)) &&
    q &&
    /\b(business|premium|economy|first)\b/i.test(text)
  ) {
    handled = true;
    const lower = text.toLowerCase();
    if (/\bbusiness\b/.test(lower) || /\bfirst\b/.test(lower)) {
      q.cabinClass = "BUSINESS";
    } else if (/\bpremium\b/.test(lower)) {
      q.cabinClass = "PREMIUM_ECONOMY";
    } else if (/\beconomy\b/.test(lower)) {
      q.cabinClass = "ECONOMY";
    }
  }

  if (invalidAnswer) {
    return { query: q, handled: false, invalidAnswer, wantRoundTrip, wantOneWay, nearby };
  }

  return { query: q, handled, wantRoundTrip, wantOneWay, nearby };
}

/**
 * Merge previous conversation travel state with the latest extraction.
 * Never replaces known slots with undefined from a partial latest message.
 */
export function mergeTravelPlan(
  incoming: TravelPlan | null,
  ctx: MergeTravelPlanCtx,
): TravelPlan | null {
  const ask = lastAssistantAsk(ctx.history);
  const previousStructured = ctx.previousPlan ?? null;
  const clarificationSlot = clarificationSlotFromContext(previousStructured, ask);
  const previousAsk =
    previousStructured?.action === "clarify" ? previousStructured.ask : ask;
  const previousFromHistory = draftPlanFromHistory(ctx.history, {
    today: ctx.today,
    defaultOriginIata: ctx.defaultOriginIata,
    defaultOriginPlace: ctx.defaultOriginPlace,
  });
  // Prefer structured previous; fall back to history reconstruction when draft slots are missing
  const previous =
    flightQueryFromPlan(previousStructured) != null
      ? previousStructured
      : previousFromHistory ?? previousStructured;

  const prevQuery = flightQueryFromPlan(previous);
  const prevFilters = filtersFromPlan(previous);

  // Off-topic always wins
  if (incoming?.action === "off_topic") return incoming;

  // Close only when we already showed results — not mid-clarify affirmations
  if (incoming?.action === "close") {
    const midClarify =
      previous?.action === "clarify" ||
      (ask &&
        (TRIP_TYPE_Q.test(ask) ||
          RETURN_DATE_Q.test(ask) ||
          DEPART_DATE_Q.test(ask) ||
          DEST_Q.test(ask) ||
          NEARBY.test(ask)));
    if (midClarify || isAffirmative(ctx.message)) {
      // Fall through — treat as contextual reply, not close
    } else {
      return { action: "close" };
    }
  }

  const incomingQuery = flightQueryFromPlan(incoming);
  let filters = {
    ...(prevFilters ?? {}),
    ...(incoming?.action === "search" ? incoming.filters ?? {} : {}),
    ...(incoming?.action === "clarify" ? incoming.draft?.filters ?? {} : {}),
  };

  const contextual = applyQuestionAwareReply(ctx.message, ask, prevQuery, {
    today: ctx.today,
    defaultOriginIata: ctx.defaultOriginIata,
    defaultOriginPlace: ctx.defaultOriginPlace,
  }, clarificationSlot);

  let mergedQuery = mergeFlightQueries(prevQuery, incomingQuery);
  mergedQuery = mergeFlightQueries(mergedQuery, contextual.query);

  // Latest explicit user slots beat previousTravelPlan (and any stale LLM echo).
  const overrides = extractExplicitSlotOverrides(ctx.message, {
    today: ctx.today,
    defaultOriginIata: ctx.defaultOriginIata,
    defaultOriginPlace: ctx.defaultOriginPlace,
    previousOrigin: prevQuery?.origin ?? null,
    previousDestination: prevQuery?.destination ?? null,
  });

  logTravelPlanDebug("previous plan", {
    origin: prevQuery?.origin ?? null,
    destination: prevQuery?.destination ?? null,
    departureDate: prevQuery?.departureDate ?? null,
  });
  logTravelPlanDebug("latest extraction", {
    incomingAction: incoming?.action ?? null,
    incomingOrigin: incomingQuery?.origin ?? null,
    incomingDestination: incomingQuery?.destination ?? null,
    overrides,
  });

  if (!mergedQuery && (overrides.origin || overrides.destination || overrides.destinationChanged)) {
    mergedQuery = {
      origin: overrides.origin || ctx.defaultOriginIata,
      destination: overrides.destination || "",
      departureDate: overrides.departureDate || "",
      passengers: 1,
    };
  }

  if (mergedQuery) {
    if (overrides.origin) mergedQuery.origin = overrides.origin;
    if (overrides.destination) mergedQuery.destination = overrides.destination;
    if (overrides.destinationChanged && !overrides.destination) {
      // Explicit new destination intent without a resolvable airport — drop stale dest.
      mergedQuery.destination = "";
    }
    const returnOnlyAsk = clarificationSlot === "returnDate";
    if (overrides.departureDateExplicit && overrides.departureDate) {
      if (returnOnlyAsk) {
        mergedQuery.returnDate = overrides.returnDate || overrides.departureDate;
      } else {
        mergedQuery.departureDate = overrides.departureDate;
      }
    }
    if (overrides.returnDate && !returnOnlyAsk) mergedQuery.returnDate = overrides.returnDate;
  }

  const changedSlots = [
    overrides.originChanged ? "origin" : null,
    overrides.destinationChanged ? "destination" : null,
    overrides.dateChanged ? "departureDate" : null,
  ].filter(Boolean);

  logTravelPlanDebug("merged plan", {
    origin: mergedQuery?.origin ?? null,
    destination: mergedQuery?.destination ?? null,
    departureDate: mergedQuery?.departureDate ?? null,
    changedSlots,
  });

  // Broad / unresolved destination (e.g. China) — never keep previous DXB / invent hubs.
  if (overrides.destinationUnresolved && overrides.destinationClarifyAsk) {
    const draftUnresolved = mergedQuery
      ? asSearchPlan(
          {
            ...mergedQuery,
            destination: "",
            ...(overrides.origin ? { origin: overrides.origin } : {}),
            ...(overrides.departureDate ? { departureDate: overrides.departureDate } : {}),
          },
          Object.keys(filters).length ? filters : undefined,
        )
      : null;
    return makeClarify(
      ["destination"],
      overrides.destinationClarifyAsk,
      draftUnresolved,
    );
  }

  if (contextual.wantOneWay && mergedQuery) {
    delete mergedQuery.returnDate;
  }
  if (contextual.nearby === true) {
    filters = { ...filters /* nearby handled as filter if project has one */ };
  }

  // Checked bag from any message — optional filter, never a blocking clarify
  if (/\b(checked\s+bag|checked\s+baggage|with\s+(a\s+)?bag)\b/i.test(ctx.message)) {
    filters = { ...filters, checkedBagRequired: true };
  }

  // Vague date band → one specific follow-up (never invent a day)
  if (contextual.vagueBand && mergedQuery && !mergedQuery.departureDate) {
    const draftVague = asSearchPlan(
      mergedQuery,
      Object.keys(filters).length ? filters : undefined,
    );
    return makeClarify(
      ["departureDate"],
      buildClarifyAsk(["departureDate"], mergedQuery, {
        previousAsk,
        slot: "departureDate",
        vagueLabel: contextual.vagueBand.label,
      }),
      draftVague,
    );
  }

  // If incoming is a complete valid search and we have no previous, use it
  if (incoming?.action === "search" && !prevQuery) {
    const v = validateSearchPlan(incoming);
    if (v.ok) return incoming;
    // Invalid incoming with no previous — still clarify (do not fall through with bad legs)
    const miss =
      v.code === "same_origin_destination"
        ? ["destination"]
        : v.code === "unknown_origin"
          ? ["origin"]
          : v.code === "unknown_destination"
            ? ["destination"]
            : v.code === "invalid_departure_date"
              ? ["departureDate"]
              : v.code === "invalid_return_date"
                ? ["returnDate"]
                : ["route"];
    return makeClarify(miss, v.message, incoming);
  }

  // Incoming package with previous flight slots — prefer merged flight if we have route
  if (!mergedQuery || (!mergedQuery.origin && !mergedQuery.destination)) {
    if (incoming && incoming.action !== "close") return incoming;
    if (previous) return previous;
    return incoming;
  }

  // Fill passengers default (optional — never ask)
  if (mergedQuery.passengers == null) mergedQuery.passengers = 1;
  if (!mergedQuery.cabinClass) mergedQuery.cabinClass = "ECONOMY";

  const datesAssumed =
    contextual.datesAssumed ||
    (incoming?.action === "search"
      ? incoming.datesAssumed
      : previous?.action === "search"
        ? previous.datesAssumed
        : undefined);

  const draft = asSearchPlan(
    mergedQuery,
    Object.keys(filters).length ? filters : undefined,
    datesAssumed,
  );

  // Round-trip is required when the user asked for it OR we are mid-clarify for returnDate.
  const awaitingReturnDate =
    Boolean(contextual.wantRoundTrip) ||
    clarificationSlot === "returnDate" ||
    (previousStructured?.action === "clarify" &&
      previousStructured.missing.some((m) => normalizeMissingSlot(m) === "returnDate"));

  // Round-trip requested / awaiting return but return missing → clarify return only
  if (awaitingReturnDate && mergedQuery && !mergedQuery.returnDate) {
    return makeClarify(
      ["returnDate"],
      buildClarifyAsk(["returnDate"], mergedQuery, {
        invalidAnswer: contextual.invalidAnswer,
        previousAsk,
        slot: "returnDate",
      }),
      draft,
    );
  }

  const missing = getMissingRequiredSlots(mergedQuery, {
    wantRoundTrip: awaitingReturnDate,
  });
  if (missing.length > 0) {
    const clarifyOpts = {
      invalidAnswer: contextual.invalidAnswer,
      previousAsk,
      slot: clarificationSlot,
    };
    if (incoming?.action === "clarify") {
      // Drop asks for slots we already have (e.g. re-asking departure when date is known)
      const relevantMissing = incoming.missing.filter((m) => {
        const key = m.toLowerCase();
        if (key.includes("origin") && mergedQuery.origin) return false;
        if (key.includes("destination") && mergedQuery.destination) return false;
        if (key.includes("departure") && mergedQuery.departureDate) return false;
        if (key.includes("return") && mergedQuery.returnDate) return false;
        // Optional slots — never re-ask from LLM clarify
        if (key.includes("passenger") || key.includes("cabin") || key.includes("airline")) {
          return false;
        }
        return true;
      });
      if (relevantMissing.length === 0 && missing.length === 0) {
        // fall through to validate/search
      } else {
        const askMissing = missing.length ? missing : relevantMissing;
        return makeClarify(
          askMissing,
          buildClarifyAsk(askMissing, mergedQuery, clarifyOpts),
          draft,
        );
      }
    } else {
      return makeClarify(
        missing,
        buildClarifyAsk(missing, mergedQuery, clarifyOpts),
        draft,
      );
    }
  }

  // All required one-way slots present — ignore stale clarify asks for known fields
  if (incoming?.action === "clarify" && missing.length === 0) {
    const asksUnknown =
      incoming.missing.some((m) => {
        const key = m.toLowerCase();
        if (key.includes("trip") || key.includes("return")) return !mergedQuery.returnDate;
        return false;
      }) &&
      !contextual.wantOneWay &&
      !contextual.wantRoundTrip;
    if (asksUnknown && /return|round/i.test(incoming.ask) && !mergedQuery.returnDate) {
      return makeClarify(["returnDate"], incoming.ask, draft);
    }
    // Trip-type ask with complete OW slots — optional; prefer search unless ask is trip type
    if (
      /one[\s-]?way|round[\s-]?trip/i.test(incoming.ask) &&
      !contextual.wantOneWay &&
      !contextual.wantRoundTrip &&
      !contextual.handled
    ) {
      return makeClarify(["tripType"], incoming.ask, draft);
    }
  }

  const validated = validateSearchPlan(draft);
  if (!validated.ok) {
    const miss =
      validated.code === "same_origin_destination"
        ? ["destination"]
        : validated.code === "unknown_origin"
          ? ["origin"]
          : validated.code === "unknown_destination"
            ? ["destination"]
            : validated.code === "invalid_departure_date"
              ? ["departureDate"]
              : validated.code === "invalid_return_date"
                ? ["returnDate"]
                : ["route"];
    return makeClarify(miss, validated.message, draft);
  }

  return draft;
}

/** Extract draft/search plan to persist across turns. */
export function planToPersist(plan: TravelPlan | null): TravelPlan | null {
  if (!plan) return null;
  if (plan.action === "search") return plan;
  if (plan.action === "clarify") {
    return plan.draft
      ? { action: "clarify", missing: plan.missing, ask: plan.ask, draft: plan.draft }
      : plan;
  }
  if (plan.action === "package") return plan;
  return null;
}

export function firstFlightQuery(plan: TravelPlan | null): FlightSearchQuery | null {
  return flightQueryFromPlan(plan);
}

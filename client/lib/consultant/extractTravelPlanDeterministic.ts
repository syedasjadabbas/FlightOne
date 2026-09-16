/**
 * Deterministic travel-plan extraction when the LLM is unavailable or returns junk.
 * Handles explicit single-leg and simple round-trip flight requests only.
 * Uses the same required-slot rules as mergeTravelPlan.
 */
import type { CabinClass, FlightSearchQuery } from "@/lib/inventory/supplierSearch";
import { extractIntent, looksComplexForHeuristic, parsePassengers } from "./intent";
import { parseFlightDatesFromMessage } from "./parseFlightDates";
import { extractFlightRouteFromMessage } from "./extractFlightRoute";
import { getMissingRequiredSlots, firstFlightQuery } from "./mergeTravelPlan";
import { extractExplicitSlotOverrides } from "./slotOverrides";
import { validateSearchPlan, type TravelPlan } from "./travelPlan";

export type DeterministicExtractOpts = {
  today: string;
  defaultOriginIata: string;
  defaultOriginPlace: string;
  /** Prior turn plan for multi-turn continuity. */
  previousPlan?: TravelPlan | null;
  history?: import("@/lib/llm").ChatTurn[];
};

export type DeterministicExtractResult =
  | { kind: "plan"; plan: Extract<TravelPlan, { action: "search" }> }
  | { kind: "clarify"; plan: Extract<TravelPlan, { action: "clarify" }> }
  | { kind: "none" };

function cabinFromIntent(cabin?: string): CabinClass {
  if (cabin === "business") return "BUSINESS";
  if (cabin === "premium") return "PREMIUM_ECONOMY";
  return "ECONOMY";
}

function clarify(
  missing: string[],
  ask: string,
  draft?: Extract<TravelPlan, { action: "search" }>,
): DeterministicExtractResult {
  return {
    kind: "clarify",
    plan: { action: "clarify", missing, ask, ...(draft ? { draft } : {}) },
  };
}

/**
 * Parse common explicit flight requests without an LLM.
 * Returns clarify when required slots are missing; none for complex multi-leg asks.
 */
export function extractTravelPlanDeterministic(
  message: string,
  opts: DeterministicExtractOpts,
): DeterministicExtractResult {
  const text = message.trim();
  if (!text) return { kind: "none" };

  if (looksComplexForHeuristic(text)) return { kind: "none" };

  const intent = extractIntent(text, [], { defaultOrigin: opts.defaultOriginPlace });
  // Pure hotel asks without flight words — leave to LLM / other paths
  if (intent.type === "hotel" && !/\b(flight|fly|flights)\b/i.test(text)) {
    return { kind: "none" };
  }

  const prevQuery = firstFlightQuery(opts.previousPlan ?? null);
  const overrides = extractExplicitSlotOverrides(text, {
    today: opts.today,
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
    previousOrigin: prevQuery?.origin ?? null,
    previousDestination: prevQuery?.destination ?? null,
  });

  // Broad / unresolved destination (China, somewhere else) — never invent hubs or keep stale DXB.
  if (overrides.destinationUnresolved && overrides.destinationClarifyAsk) {
    const draftQuery: FlightSearchQuery = {
      origin: overrides.origin || prevQuery?.origin || opts.defaultOriginIata,
      destination: "",
      departureDate: overrides.departureDate || prevQuery?.departureDate || "",
      passengers: Math.min(9, Math.max(1, parsePassengers(text) ?? intent.passengers ?? 1)),
      cabinClass: cabinFromIntent(intent.cabin),
    };
    return clarify(
      ["destination"],
      overrides.destinationClarifyAsk,
      {
        action: "search",
        searches: [{ product: "FLIGHT", query: draftQuery }],
      },
    );
  }

  const route = extractFlightRouteFromMessage(text, {
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
  });

  if (!route && !overrides.origin && !overrides.destination && !overrides.dateChanged) {
    if (intent.destination) {
      return clarify(
        ["destination"],
        "I couldn't verify that destination airport. Which city are you flying to?",
      );
    }
    return clarify(["destination"], "Where would you like to fly to?");
  }

  const dates = parseFlightDatesFromMessage(text, opts.today);
  const passengers = parsePassengers(text) ?? intent.passengers ?? 1;
  const query: FlightSearchQuery = {
    origin: overrides.origin || route?.origin || prevQuery?.origin || opts.defaultOriginIata,
    destination:
      overrides.destination ||
      (overrides.destinationChanged ? "" : route?.destination || prevQuery?.destination || ""),
    departureDate:
      (overrides.departureDateExplicit && overrides.departureDate) ||
      dates?.departureDate ||
      prevQuery?.departureDate ||
      "",
    ...(overrides.returnDate || dates?.returnDate
      ? { returnDate: overrides.returnDate || dates?.returnDate }
      : prevQuery?.returnDate
        ? { returnDate: prevQuery.returnDate }
        : {}),
    passengers: Math.min(9, Math.max(1, passengers)),
    cabinClass: cabinFromIntent(intent.cabin),
  };

  const filters = {
    ...(intent.filters ?? {}),
    ...( /\b(checked\s+bag|checked\s+baggage)\b/i.test(text)
      ? { checkedBagRequired: true }
      : {}),
  };

  const draft: Extract<TravelPlan, { action: "search" }> = {
    action: "search",
    searches: [{ product: "FLIGHT", query }],
    ...(Object.keys(filters).length ? { filters } : {}),
    ...(dates?.yearInferred ? { datesAssumed: true } : {}),
  };

  if (dates?.vague && !dates.departureDate) {
    return clarify(
      ["departureDate"],
      `Do you have a specific date, or should I search around ${dates.vague.label}?`,
      draft,
    );
  }

  const missing = getMissingRequiredSlots(query);
  if (missing.length > 0) {
    if (missing.includes("departureDate")) {
      return clarify(
        ["departureDate"],
        "What date would you like to depart?",
        draft,
      );
    }
    if (missing.includes("destination")) {
      return clarify(["destination"], "Where would you like to fly to?", draft);
    }
    if (missing.includes("origin")) {
      return clarify(["origin"], "Where are you flying from?", draft);
    }
    return clarify(missing, "Could you share a bit more about your trip?", draft);
  }

  if (dates?.returnDate && dates.departureDate && dates.returnDate < dates.departureDate) {
    return clarify(
      ["returnDate"],
      "The return date must be on or after your outbound departure date.",
      draft,
    );
  }

  const validation = validateSearchPlan(draft);
  if (!validation.ok) {
    const miss =
      validation.code === "unknown_origin"
        ? ["origin"]
        : validation.code === "unknown_destination"
          ? ["destination"]
          : validation.code === "invalid_departure_date"
            ? ["departureDate"]
            : validation.code === "invalid_return_date"
              ? ["returnDate"]
              : validation.code === "same_origin_destination"
                ? ["destination"]
                : ["route"];
    return clarify(miss, validation.message, draft);
  }

  return { kind: "plan", plan: draft };
}

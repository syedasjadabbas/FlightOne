/**
 * Adapter: consultant LLM TravelPlan → PlanningTravelPlan.
 * Derives hard constraints / soft preferences without a second intent SSOT.
 */
import type { TravelPlan as ConsultantTravelPlan, SearchLeg } from "@/lib/consultant/travelPlan";
import type { IntentFilters } from "@/lib/consultant/types";
import {
  type PlanningTravelPlan,
  type PlanningLeg,
  type TravelConstraint,
  type TravelPreference,
  type TripType,
  type OptimizationGoal,
} from "./types";

function flightLegs(searches: SearchLeg[]) {
  return searches.filter(
    (s): s is Extract<SearchLeg, { product: "FLIGHT" }> => s.product === "FLIGHT",
  );
}

function nightsBetweenIso(a?: string, b?: string): number | null {
  if (!a || !b || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return null;
  }
  const msA = Date.parse(`${a}T12:00:00Z`);
  const msB = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(msA) || !Number.isFinite(msB)) return null;
  const n = Math.round((msB - msA) / 86_400_000);
  return n >= 0 ? n : null;
}

const CITY_ALIASES: Record<string, string[]> = {
  LON: ["london", "lhr", "lgw", "lon"],
  LHR: ["london", "lhr", "heathrow"],
  SFO: ["san francisco", "sfo", "sf"],
  MCO: ["orlando", "mco"],
  AUH: ["abu dhabi", "auh"],
  DXB: ["dubai", "dxb"],
};

/** Attach exact stay hard-constraints from phrases like "2 nights in London". */
function applyStayHeuristicsFromMessage(message: string, legs: PlanningLeg[]): void {
  const m = message.toLowerCase();
  const nightMatches = [...m.matchAll(/(\d{1,2})\s*-?\s*nights?\s+(?:in|at|stopover(?:\s+in)?)\s+([a-z\s]+?)(?:\s*,|\s+then|\s+and|\s+stay|\s+return|$)/gi)];
  const dayMatches = [...m.matchAll(/(?:stay|staying)?\s*(\d{1,2})\s*-?\s*days?\s+(?:in|at)\s+([a-z\s]+?)(?:\s*,|\s+then|\s+and|\s+return|$)/gi)];

  const apply = (nights: number, cityRaw: string, asDays: boolean) => {
    const city = cityRaw.trim().toLowerCase();
    for (let i = 0; i < legs.length - 1; i++) {
      const dest = legs[i].destination.toUpperCase();
      const aliases = CITY_ALIASES[dest] || [dest.toLowerCase()];
      const hit =
        aliases.some((a) => city.includes(a) || a.includes(city.split(/\s+/)[0] || "")) ||
        city.includes(dest.toLowerCase());
      if (!hit) continue;
      legs[i] = {
        ...legs[i],
        stay: {
          nights: asDays ? nights : nights,
          days: nights,
          exact: true,
        },
        purpose: nights >= 7 ? "main_destination" : "stopover",
      };
      return;
    }
  };

  for (const match of nightMatches) {
    apply(Number(match[1]), match[2], false);
  }
  for (const match of dayMatches) {
    apply(Number(match[1]), match[2], true);
  }

  // Fallback patterns: "2-night stopover in London", "stay in SFO 15 days"
  const altNight = m.match(/(\d{1,2})-?\s*night\s+stopover\s+in\s+([a-z\s]+)/i);
  if (altNight) apply(Number(altNight[1]), altNight[2], false);
  const altStay = m.match(/stay(?:ing)?\s+in\s+([a-z\s]+?)\s+(?:for\s+)?(\d{1,2})\s*days?/i);
  if (altStay) apply(Number(altStay[2]), altStay[1], true);
}

function inferTripType(
  flights: ReturnType<typeof flightLegs>,
  message: string,
): TripType {
  const m = message.toLowerCase();
  if (flights.length === 0) return "hotel";
  if (flights.length === 1 && flights[0].query.returnDate) return "round_trip";
  if (flights.length === 1) return "one_way";
  if (
    /\bopen[- ]?jaw\b/.test(m) ||
    /\breturn from\b/.test(m) ||
    /\bback from\b/.test(m)
  ) {
    return "open_jaw";
  }
  return "multi_city";
}

function optimizationGoal(message: string, filters?: IntentFilters): OptimizationGoal {
  const m = message.toLowerCase();
  if (/\bcheapest\b|\blowest fare\b|\bbest fare\b|\bbest price\b|\blowest price\b|\bbudget\b/.test(m)) {
    return "cheapest";
  }
  if (/\bfastest\b|\bquickest\b|\bnon[- ]?stop\b/.test(m) || filters?.nonstopOnly) {
    return "fastest";
  }
  if (/\bpremium\b|\bbusiness\b|\bfirst class\b/.test(m)) return "premium";
  if (/\bbest value\b|\bbalanced\b/.test(m)) return "best_value";
  return "balanced";
}

/**
 * Convert a search-action consultant plan into the richer planning model.
 * Returns null for clarify/close/package/off_topic.
 */
export function fromConsultantPlan(
  plan: ConsultantTravelPlan,
  message: string,
): PlanningTravelPlan | null {
  if (plan.action === "package") {
    return {
      tripType: "package",
      origins: [plan.origin],
      legs: [{ destination: plan.destination, date: plan.departureDate, purpose: "outbound" }],
      passengers: plan.passengers ?? 1,
      hardConstraints: [],
      softPreferences: [],
      optimizationGoal: "best_value",
      datesAssumed: plan.datesAssumed,
    };
  }
  if (plan.action !== "search") return null;

  const flights = flightLegs(plan.searches);
  if (flights.length === 0) return null;

  const tripType = inferTripType(flights, message);
  const origins = [...new Set(flights.map((f) => f.query.origin))];
  // Prefer first-leg origin as primary; keep unique origins for multi-origin asks.
  const firstOrigin = flights[0].query.origin;
  const originSet = origins.includes(firstOrigin)
    ? [firstOrigin, ...origins.filter((o) => o !== firstOrigin)]
    : origins;

  const legs: PlanningLeg[] = flights.map((f, i) => {
    const next = flights[i + 1];
    const stayNights = next
      ? nightsBetweenIso(f.query.departureDate, next.query.departureDate)
      : null;
    const purpose: PlanningLeg["purpose"] =
      i === 0
        ? "outbound"
        : i === flights.length - 1
          ? "return"
          : stayNights != null && stayNights >= 2
            ? stayNights >= 7
              ? "main_destination"
              : "stopover"
            : "positioning";

    return {
      origin: f.query.origin,
      destination: f.query.destination,
      date: f.query.departureDate,
      ...(stayNights != null && stayNights > 0 && i < flights.length - 1
        ? {
            // Date-derived stays are approximate (depart−depart) until arrivals exist —
            // never hard-gate on exact until message heuristics below override.
            stay: {
              nights: stayNights,
              days: stayNights,
              exact: false,
            },
          }
        : {}),
      purpose,
    };
  });

  applyStayHeuristicsFromMessage(message, legs);

  // Round-trip with returnDate on a single search → synthetic return hint.
  if (flights.length === 1 && flights[0].query.returnDate) {
    const q = flights[0].query;
    const stayN = nightsBetweenIso(q.departureDate, q.returnDate);
    if (stayN != null && stayN > 0 && !legs[0].stay?.exact) {
      legs[0] = {
        ...legs[0],
        stay: { nights: stayN, days: stayN, exact: false },
        purpose: "outbound",
      };
    }
  }

  const hardConstraints: TravelConstraint[] = [];
  const softPreferences: TravelPreference[] = [];

  for (let i = 0; i < legs.length - 1; i++) {
    const leg = legs[i];
    if (leg.stay?.exact && leg.stay.nights != null) {
      hardConstraints.push({
        type: "stay_nights",
        value: { city: leg.destination, nights: leg.stay.nights, afterLegIndex: i },
        hard: true,
        description: `Stay ${leg.stay.nights} night(s) in/near ${leg.destination}`,
      });
    } else if (leg.stay?.exact && leg.stay.days != null) {
      hardConstraints.push({
        type: "stay_nights",
        value: { city: leg.destination, nights: leg.stay.days, afterLegIndex: i },
        hard: true,
        description: `Stay ${leg.stay.days} day(s) in/near ${leg.destination}`,
      });
    }
  }

  if (tripType === "open_jaw" || tripType === "multi_city") {
    const last = legs[legs.length - 1];
    if (last?.origin) {
      hardConstraints.push({
        type: "return_depart_city",
        value: { iata: last.origin },
        hard: true,
        description: `Return departs from ${last.origin}`,
      });
    }
    for (const leg of legs) {
      hardConstraints.push({
        type: "visit_destination",
        value: { iata: leg.destination },
        hard: true,
        description: `Include destination ${leg.destination}`,
      });
    }
  }

  const filters = plan.filters;
  if (filters?.preferredAirlines?.length) {
    softPreferences.push({
      type: "preferred_airlines",
      value: filters.preferredAirlines,
      weight: 0.7,
      description: `Prefer ${filters.preferredAirlines.join("/")}`,
    });
  }
  if (filters?.nonstopOnly) {
    softPreferences.push({
      type: "nonstop",
      value: true,
      weight: 0.8,
      description: "Prefer non-stop where possible",
    });
  }
  if (filters?.maxStops != null) {
    softPreferences.push({
      type: "max_stops",
      value: filters.maxStops,
      weight: 0.6,
      description: `Prefer ≤${filters.maxStops} stop(s)`,
    });
  }

  const passengers = flights[0].query.passengers ?? 1;
  const cabin = flights[0].query.cabinClass;

  return {
    tripType,
    origins: originSet,
    legs,
    passengers,
    ...(cabin ? { cabin } : {}),
    hardConstraints,
    softPreferences,
    optimizationGoal: optimizationGoal(message, filters),
    ...(filters ? { filters } : {}),
    datesAssumed: plan.datesAssumed,
  };
}

/** True when the itinerary pipeline should run instead of per-offer curate. */
export function shouldBuildItineraries(
  plan: PlanningTravelPlan | null,
  flightSearchCount: number,
): boolean {
  if (!plan) return flightSearchCount > 1;
  if (plan.tripType === "multi_city" || plan.tripType === "open_jaw") return true;
  return flightSearchCount > 1;
}

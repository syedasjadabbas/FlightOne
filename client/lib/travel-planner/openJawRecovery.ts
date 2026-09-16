/**
 * Open-jaw / stopover search reshape.
 *
 * Desired journey shape for asks like
 * “Lahore → 2 nights London → SFO → return from Orlando”:
 *   1) origin(s) → London
 *   2) London → SFO   (or a single ticket via London when that exists)
 *   3) mainDest → returnOrigin (positioning — searched when GDS inventory exists)
 *   4) returnOrigin → home
 * When positioning GDS returns nothing, journeys still assemble with a landside gap.
 */
import { airportsForMetro, sameMetro } from "@/lib/comps/altAirports";
import type { TravelPlan, SearchLeg } from "@/lib/consultant/travelPlan";
import { MAX_SEARCH_LEGS } from "@/lib/consultant/travelPlan";
import type { CabinClass } from "@/lib/consultant/travelPlan";
import { addDaysIso, isKnownIata } from "@/lib/inventory/places";
import { isFlight, type FlightOffer, type Offer } from "@/lib/inventory/types";
import type { PlanningTravelPlan, TravelPreference } from "./types";

export type RecoverySearchStage =
  | "to_stopover"
  | "to_main"
  | "via_main_direct"
  | "positioning"
  | "return";

export interface OpenJawRecoveryResult {
  plan: Extract<TravelPlan, { action: "search" }>;
  /** Parallel to plan.searches — used to merge fan-out into journey stages. */
  searchStages: RecoverySearchStage[];
  /** Positioning hop in original plan (e.g. SFO→MCO) — searched via GDS when present. */
  positioningRoute: string | null;
  positioningSearched: boolean;
  /** @deprecated Landside hop not searched — only when positioningRoute absent. */
  droppedPositioning: string | null;
  stopoverAirports: string[];
  mainDest: string;
  returnOrigin: string;
  home: string;
  note: string;
}

function flightSearches(searches: SearchLeg[]) {
  return searches.filter(
    (s): s is Extract<SearchLeg, { product: "FLIGHT" }> => s.product === "FLIGHT",
  );
}

/** True when at least one interior flight bucket is empty while ends have inventory. */
export function hasEmptyInteriorBuckets(legs: Offer[][]): boolean {
  if (legs.length < 3) return false;
  const counts = legs.map((b) => b.filter(isFlight).length);
  const midEmpty = counts.slice(1, -1).some((n) => n === 0);
  if (!midEmpty) return false;
  return counts[0] > 0 || counts[counts.length - 1] > 0;
}

export function inferMainDestination(
  planning: PlanningTravelPlan | null,
  flights: ReturnType<typeof flightSearches>,
): string {
  if (planning?.legs.length) {
    let best: { iata: string; nights: number } | null = null;
    for (const leg of planning.legs) {
      const nights = leg.stay?.nights ?? leg.stay?.days ?? 0;
      if (leg.purpose === "main_destination") {
        return leg.destination.toUpperCase();
      }
      if (nights > (best?.nights ?? -1)) {
        best = { iata: leg.destination.toUpperCase(), nights };
      }
    }
    if (best && best.nights >= 7) return best.iata;
  }

  if (flights.length >= 2) {
    const returnLeg = flights[flights.length - 1];
    for (let i = flights.length - 2; i >= 0; i--) {
      const dest = flights[i].query.destination.toUpperCase();
      if (dest !== returnLeg.query.destination.toUpperCase()) return dest;
    }
  }
  return flights[0]?.query.destination.toUpperCase() || "";
}

function uniqueIatas(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const u = c.toUpperCase();
    if (!/^[A-Z]{3}$/.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function msgOriginCandidates(message: string, firstOrigin: string, home: string): string[] {
  const fromMsg = (message.match(/\b(lahore|islamabad|karachi|lhe|isb|khi)\b/gi) || []).map(
    (w) => {
      const t = w.toLowerCase();
      if (t === "lahore" || t === "lhe") return "LHE";
      if (t === "islamabad" || t === "isb") return "ISB";
      if (t === "karachi" || t === "khi") return "KHI";
      return "";
    },
  );
  return uniqueIatas([
    firstOrigin,
    ...fromMsg,
    ...airportsForMetro(firstOrigin).slice(0, 3),
    home,
    ...airportsForMetro(home).slice(0, 2),
  ])
    .filter(isKnownIata)
    .slice(0, 3);
}

/** Stopover cities on the way to mainDest (e.g. London), excluding home. */
export function inferStopoverAirports(
  planning: PlanningTravelPlan | null,
  flights: ReturnType<typeof flightSearches>,
  mainDest: string,
  home: string,
): string[] {
  const stopCodes: string[] = [];
  if (planning?.legs.length) {
    for (const leg of planning.legs) {
      if (leg.purpose === "stopover") stopCodes.push(leg.destination);
    }
  }
  for (const f of flights.slice(0, -1)) {
    const dest = f.query.destination.toUpperCase();
    if (dest !== mainDest && dest !== home) stopCodes.push(dest);
  }
  const primary = uniqueIatas(stopCodes);
  if (primary.length === 0) return [];
  // Expand first stopover to metro airports (LHR + LGW) — only known IATAs.
  return uniqueIatas(primary.flatMap((c) => airportsForMetro(c).slice(0, 2)))
    .filter(isKnownIata)
    .slice(0, 3);
}

export function shouldReshapeOpenJaw(
  plan: Extract<TravelPlan, { action: "search" }>,
  planning: PlanningTravelPlan | null,
  legs?: Offer[][],
): boolean {
  const flights = flightSearches(plan.searches);
  if (flights.length < 3) return false;
  if (planning && planning.tripType !== "open_jaw" && planning.tripType !== "multi_city") {
    return false;
  }
  const mainDest = inferMainDestination(planning, flights);
  const last = flights[flights.length - 1].query;
  const returnOrigin = last.origin.toUpperCase();
  const hasPositioning = flights.some(
    (f) =>
      f.query.origin.toUpperCase() === mainDest &&
      f.query.destination.toUpperCase() === returnOrigin,
  );
  const hasStopover = inferStopoverAirports(planning, flights, mainDest, last.destination).length > 0;
  if (!hasStopover && !hasPositioning) return false;
  if (legs && hasEmptyInteriorBuckets(legs)) return true;
  return hasPositioning || hasStopover;
}

function flightQuery(
  origin: string,
  destination: string,
  departureDate: string,
  template: {
    passengers?: number;
    cabinClass?: CabinClass;
    requestedCurrency?: string;
  },
): SearchLeg {
  return {
    product: "FLIGHT",
    query: {
      origin,
      destination,
      departureDate,
      passengers: template.passengers ?? 1,
      ...(template.cabinClass ? { cabinClass: template.cabinClass } : {}),
      ...(template.requestedCurrency
        ? { requestedCurrency: template.requestedCurrency }
        : {}),
    },
  };
}

/**
 * Reshape to: origins→stopover · stopover→main · returnOrigin→home.
 * Optionally add origin→main direct searches (via London connection hunting).
 */
export function buildOpenJawRecoveryPlan(
  plan: Extract<TravelPlan, { action: "search" }>,
  planning: PlanningTravelPlan | null,
  message: string,
): OpenJawRecoveryResult | null {
  const flights = flightSearches(plan.searches);
  if (flights.length < 3) return null;

  const mainDest = inferMainDestination(planning, flights);
  if (!mainDest) return null;

  const first = flights[0].query;
  const last = flights[flights.length - 1].query;
  const home = last.destination.toUpperCase();
  const returnOrigin = last.origin.toUpperCase();
  if (returnOrigin === mainDest) return null;

  const stopoverAirports = inferStopoverAirports(planning, flights, mainDest, home);
  if (stopoverAirports.length === 0) return null;

  const positioningLeg = flights.find(
    (f) =>
      f.query.origin.toUpperCase() === mainDest &&
      f.query.destination.toUpperCase() === returnOrigin,
  );
  const positioningRoute = positioningLeg
    ? `${mainDest}→${returnOrigin}`
    : null;
  const droppedPositioning = null;

  // Dates from original chain
  const toStopoverDate = first.departureDate;
  const stopoverToMainFlight = flights.find((f) => {
    const o = f.query.origin.toUpperCase();
    const d = f.query.destination.toUpperCase();
    return stopoverAirports.some((s) => sameMetro(s, o) || s === o) && d === mainDest;
  });
  const toMainDate =
    stopoverToMainFlight?.query.departureDate ||
    flights.find((f) => f.query.destination.toUpperCase() === mainDest)?.query.departureDate ||
    addDaysIso(toStopoverDate, 2);
  const returnDate = last.departureDate;

  const origins = msgOriginCandidates(message, first.origin, home);
  const template = {
    passengers: first.passengers ?? 1,
    cabinClass: first.cabinClass,
    requestedCurrency: first.requestedCurrency,
  };

  const searches: SearchLeg[] = [];
  const searchStages: RecoverySearchStage[] = [];

  const push = (leg: SearchLeg, stage: RecoverySearchStage) => {
    if (searches.length >= MAX_SEARCH_LEGS) return false;
    // Dedupe identical flight queries
    if (leg.product === "FLIGHT") {
      const key = `${leg.query.origin}-${leg.query.destination}-${leg.query.departureDate}`;
      const dup = searches.some(
        (s) =>
          s.product === "FLIGHT" &&
          `${s.query.origin}-${s.query.destination}-${s.query.departureDate}` === key,
      );
      if (dup) return true;
    }
    searches.push(leg);
    searchStages.push(stage);
    return true;
  };

  // Budget (MAX_SEARCH_LEGS=7): return · origins→stopover · stopover→main · positioning · via-London direct.
  push(flightQuery(returnOrigin, home, returnDate, template), "return");

  const primaryStop = stopoverAirports[0];
  const secondaryStop = stopoverAirports[1] || primaryStop;
  push(flightQuery(origins[0], primaryStop, toStopoverDate, template), "to_stopover");
  if (origins[1]) {
    push(flightQuery(origins[1], primaryStop, toStopoverDate, template), "to_stopover");
  } else if (secondaryStop !== primaryStop) {
    push(flightQuery(origins[0], secondaryStop, toStopoverDate, template), "to_stopover");
  }

  push(flightQuery(primaryStop, mainDest, toMainDate, template), "to_main");
  if (secondaryStop !== primaryStop) {
    push(flightQuery(secondaryStop, mainDest, toMainDate, template), "to_main");
  } else if (!positioningLeg) {
    push(
      flightQuery(primaryStop, mainDest, addDaysIso(toMainDate, 1), template),
      "to_main",
    );
  }

  const positioningSearched = Boolean(positioningLeg);
  if (positioningLeg) {
    push(
      flightQuery(
        positioningLeg.query.origin,
        positioningLeg.query.destination,
        positioningLeg.query.departureDate,
        template,
      ),
      "positioning",
    );
  }

  // Via-London connection hunt on origin→main (used only when Lon→main is empty).
  push(flightQuery(origins[0], mainDest, toStopoverDate, template), "via_main_direct");
  if (origins[1] && searches.length < MAX_SEARCH_LEGS && !positioningLeg) {
    push(flightQuery(origins[1], mainDest, toStopoverDate, template), "via_main_direct");
  }

  if (searches.length < 2) return null;

  const note = [
    `Journey shape: ${origins.join("/")}→${stopoverAirports.join("/")} then →${mainDest}, return ${returnOrigin}→${home}.`,
    `Prefer a London connection on the way to ${mainDest} when inventory allows; otherwise ticket London and ${mainDest} as separate hops.`,
    positioningRoute
      ? `Positioning ${positioningRoute} searched via GDS; self-transfer when no inventory.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    plan: {
      action: "search",
      searches,
      ...(plan.filters ? { filters: plan.filters } : {}),
      ...(plan.datesAssumed ? { datesAssumed: true } : {}),
    },
    searchStages,
    positioningRoute,
    positioningSearched,
    droppedPositioning,
    stopoverAirports,
    mainDest,
    returnOrigin,
    home,
    note,
  };
}

export function planningPlanForOpenJawRecovery(
  recovery: OpenJawRecoveryResult,
  originalMessage: string,
  basePlanning: PlanningTravelPlan | null,
): PlanningTravelPlan {
  const flights = flightSearches(recovery.plan.searches);
  const toStop = flights.find((_, i) => recovery.searchStages[i] === "to_stopover");
  const toMain = flights.find((_, i) => recovery.searchStages[i] === "to_main");
  const positioning = flights.find((_, i) => recovery.searchStages[i] === "positioning");
  const homebound = flights.filter((_, i) => recovery.searchStages[i] === "return").at(-1);

  const stopover = recovery.stopoverAirports[0];
  const mainDest = recovery.mainDest;
  const origins = uniqueIatas(
    flights
      .filter((_, i) => recovery.searchStages[i] === "to_stopover")
      .map((f) => f.query.origin),
  );

  const nightMatch = originalMessage.match(
    /(\d{1,2})\s*-?\s*nights?\s+(?:stopover\s+)?(?:in|at)\s+([a-z\s]+)/i,
  );
  const stopoverNights = nightMatch ? Number(nightMatch[1]) : 2;

  const stayMatch =
    originalMessage.match(
      /stay(?:ing)?\s+(?:in\s+)?(?:san\s+francisco|sfo)?\s*(?:for\s+)?(\d{1,2})\s*days?/i,
    ) ||
    originalMessage.match(/(\d{1,2})\s*days?\s+(?:in|at)\s+(?:san\s+francisco|sfo)/i);
  const mainStayDays = stayMatch ? Number(stayMatch[1]) : undefined;

  const soft: TravelPreference[] = [
    ...(basePlanning?.softPreferences || []),
    {
      type: "preferred_via",
      value: { hubs: recovery.stopoverAirports },
      weight: 0.75,
      description: `Prefer itineraries via ${recovery.stopoverAirports.join("/")}`,
    },
  ];

  return {
    tripType: "open_jaw",
    origins: origins.length ? origins : [toStop?.query.origin || "LHE"],
    passengers: toStop?.query.passengers ?? basePlanning?.passengers ?? 1,
    ...(toStop?.query.cabinClass || basePlanning?.cabin
      ? { cabin: toStop?.query.cabinClass || basePlanning?.cabin }
      : {}),
    legs: [
      {
        origin: toStop?.query.origin,
        destination: stopover,
        date: toStop?.query.departureDate,
        purpose: "stopover",
        stay: { nights: stopoverNights, days: stopoverNights, exact: false },
      },
      {
        origin: stopover,
        destination: mainDest,
        date: toMain?.query.departureDate,
        purpose: "main_destination",
        ...(mainStayDays
          ? { stay: { nights: mainStayDays, days: mainStayDays, exact: false } }
          : {}),
      },
      ...(positioning
        ? [
            {
              origin: positioning.query.origin,
              destination: positioning.query.destination,
              date: positioning.query.departureDate,
              purpose: "positioning" as const,
            },
          ]
        : []),
      {
        origin: recovery.returnOrigin,
        destination: recovery.home,
        date: homebound?.query.departureDate,
        purpose: "return",
      },
    ],
    hardConstraints: [
      {
        type: "return_depart_city",
        value: { iata: recovery.returnOrigin },
        hard: true,
        description: `Return departs from ${recovery.returnOrigin}`,
      },
      {
        type: "visit_destination",
        value: { iata: stopover },
        hard: true,
        description: `Include stopover ${stopover}`,
      },
      {
        type: "visit_destination",
        value: { iata: mainDest },
        hard: true,
        description: `Include destination ${mainDest}`,
      },
    ],
    softPreferences: soft,
    optimizationGoal: basePlanning?.optimizationGoal || "best_value",
    ...(recovery.plan.filters ? { filters: recovery.plan.filters } : {}),
    flexible: { airports: true, dates: true, airlines: true },
    datesAssumed: recovery.plan.datesAssumed,
  };
}

/** Merge fan-out searches into journey-stage buckets. */
export function mergeRecoveryBuckets(
  searches: SearchLeg[],
  buckets: Offer[][],
  searchStages: RecoverySearchStage[],
): Offer[][] {
  if (buckets.length !== searches.length || searchStages.length !== searches.length) {
    return buckets.filter((b) => b.some(isFlight));
  }

  const mergeStage = (stage: RecoverySearchStage): Offer[] => {
    const out: Offer[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < searches.length; i++) {
      if (searchStages[i] !== stage || searches[i].product !== "FLIGHT") continue;
      for (const o of buckets[i] || []) {
        if (!isFlight(o) || seen.has(o.id)) continue;
        seen.add(o.id);
        out.push(o);
      }
    }
    return out;
  };

  const toStopover = mergeStage("to_stopover");
  const toMain = mergeStage("to_main");
  const positioning = mergeStage("positioning");
  const viaDirect = mergeStage("via_main_direct");
  const ret = mergeStage("return");

  // Prefer explicit stopover→main hops; fall back to origin→main that touch the stopover hub.
  const viaLondonDirect = viaDirect.filter((o) =>
    isFlight(o) ? flightTouchesHubs(o, searchStagesStopovers(searchStages, searches)) : false,
  );

  if (toMain.length > 0) {
    if (positioning.length > 0) {
      return [toStopover, toMain, positioning, ret];
    }
    return [toStopover, toMain, ret];
  }
  if (viaLondonDirect.length > 0 && toStopover.length === 0) {
    // Single-ticket via London + open-jaw return (no separate overnight ticket).
    return [viaLondonDirect, ret];
  }
  // Keep stopover + empty main + return so caller can detect the missing Lon→SFO gap.
  return [toStopover, toMain, ret];
}

function searchStagesStopovers(
  stages: RecoverySearchStage[],
  searches: SearchLeg[],
): string[] {
  const out: string[] = [];
  for (let i = 0; i < stages.length; i++) {
    if (stages[i] !== "to_stopover") continue;
    const leg = searches[i];
    if (leg.product !== "FLIGHT") continue;
    out.push(leg.query.destination);
  }
  return uniqueIatas(out);
}

/** True when the flown itinerary visits any of the hubs (connection or endpoint). */
export function flightTouchesHubs(offer: FlightOffer, hubs: string[]): boolean {
  if (!hubs.length) return false;
  const codes = new Set(
    [
      offer.originCode,
      offer.destinationCode,
      ...(offer.segments || []).flatMap((s) => [s.originCode, s.destinationCode]),
    ].map((c) => c.toUpperCase()),
  );
  return hubs.some((h) => {
    const H = h.toUpperCase();
    if (codes.has(H)) return true;
    return [...codes].some((c) => sameMetro(c, H));
  });
}

/** Missing Lon→SFO after reshape: keep London + return cards for an honest gap story. */
export function partialStopoverReturnOffers(stageBuckets: Offer[][]): {
  toStopover: Offer[];
  toMain: Offer[];
  homebound: Offer[];
  missingMainHop: boolean;
} {
  if (stageBuckets.length === 2) {
    // via-direct + return shape
    return {
      toStopover: [],
      toMain: stageBuckets[0].filter(isFlight),
      homebound: stageBuckets[1].filter(isFlight),
      missingMainHop: false,
    };
  }
  const toStopover = (stageBuckets[0] || []).filter(isFlight);
  const toMain = (stageBuckets[1] || []).filter(isFlight);
  const homebound = (stageBuckets[2] || []).filter(isFlight);
  return {
    toStopover,
    toMain,
    homebound,
    missingMainHop: toMain.length === 0 && toStopover.length > 0,
  };
}

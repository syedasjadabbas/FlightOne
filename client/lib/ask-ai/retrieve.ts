import { search, type OfferQuery } from "@/lib/inventory/inventory";
import { searchLiveFlights } from "@/lib/inventory/liveFlights";
import { searchLiveHotels } from "@/lib/inventory/liveHotels";
import { searchSuppliers } from "@/lib/inventory/supplierSearch";
import { searchFlightsWithRouting } from "@/lib/inventory/searchFlightsRouted";
import {
  DEFAULT_ORIGIN_PLACE,
  iataToPlace,
  placeToIata,
} from "@/lib/inventory/places";
import { isFlight, isHotel, isPackage, type Offer } from "@/lib/inventory/types";
import type { TravellerLocation } from "@/lib/geo/types";
import { hotelNameMatches } from "@/lib/consultant/knownHotels";
import type { ExtractedIntent } from "@/lib/consultant/types";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import {
  fillEmptyFlightLegsFromWeb,
  isWebMetaConfigured,
} from "@/lib/comps/webLegFallback";
import { allowSeedFlightFallback, isLiveFlightSearchEnabled } from "@/lib/flight-search/liveSearch";

export type FlightSearchFailure =
  | "travelport_unavailable"
  | "travelport_failed"
  | "travelport_timeout";

export type RetrieveResult = {
  exact: Offer[];
  alternatives: Offer[];
  liveFlights: boolean;
  liveHotels: boolean;
  legs?: Offer[][];
  /** Per search leg: true when offers came from live GDS (not seed fallback). */
  legLive?: boolean[];
  /** Per search leg: true when empty GDS leg was filled from Google Flights reference. */
  legWeb?: boolean[];
  /** Set when a live flight search was attempted but the supplier call failed. */
  searchFailure?: FlightSearchFailure;
  /** True when Travelport returned successfully but zero flight offers. */
  liveSearchEmpty?: boolean;
};

function carriersForPreferredLeg(
  preferred: string[],
  flightIndex: number,
  flightLegCount: number,
): string[] {
  if (preferred.length === 0) return [];
  if (preferred.length === 1 || flightLegCount <= 1) return preferred;
  if (flightIndex === 0) return [preferred[0]];
  return preferred.slice(1);
}

function intentFromSearchLeg(
  leg: Extract<TravelPlan, { action: "search" }>["searches"][number],
  base: ExtractedIntent,
): ExtractedIntent {
  if (leg.product === "FLIGHT") {
    return {
      ...base,
      type: "flight",
      origin: iataToPlace(leg.query.origin),
      destination: iataToPlace(leg.query.destination),
      departureDate: leg.query.departureDate,
      returnDate: leg.query.returnDate,
      hotelName: undefined,
    };
  }
  return {
    ...base,
    type: "hotel",
    destination: iataToPlace(leg.query.cityCode),
    hotelName: leg.query.hotelName,
    departureDate: leg.query.checkInDate,
    returnDate: leg.query.checkOutDate,
  };
}

function intentToQuery(intent: ExtractedIntent): OfferQuery {
  return {
    type: intent.type,
    origin: intent.origin,
    destination: intent.destination,
    city: intent.type === "hotel" ? intent.destination : undefined,
    maxBudgetMinor: intent.maxBudgetMinor,
    cabin: intent.cabin,
    minStars: intent.minStars,
  };
}

export async function retrieveFromPlan(
  plan: Extract<TravelPlan, { action: "search" }>,
  intent: ExtractedIntent,
  location: TravellerLocation | null,
): Promise<RetrieveResult> {
  const currency = location?.currency;
  const searches = plan.searches.map((leg) => {
    if (leg.product === "HOTEL" && currency && !leg.query.requestedCurrency) {
      return {
        ...leg,
        query: {
          ...leg.query,
          requestedCurrency: currency.toUpperCase().slice(0, 3),
        },
      };
    }
    return leg;
  });

  const airlinesOnly = plan.filters?.airlinesOnly || intent.filters?.airlinesOnly;
  const preferredAll = (
    airlinesOnly?.length
      ? airlinesOnly
      : plan.filters?.preferredAirlines || intent.filters?.preferredAirlines || []
  )
    .map((c) => c.toUpperCase())
    .filter((c) => /^[A-Z0-9]{2}$/.test(c));
  const flightLegCount = searches.filter((s) => s.product === "FLIGHT").length;

  const liveResults = await Promise.all(
    searches.map((body, index) => {
      if (body.product !== "FLIGHT") {
        return searchSuppliers(body);
      }
      const flightIndex = searches.slice(0, index).filter((s) => s.product === "FLIGHT").length;
      const carriersForLeg = carriersForPreferredLeg(preferredAll, flightIndex, flightLegCount);
      return searchFlightsWithRouting(body.query, carriersForLeg);
    }),
  );

  const legBuckets: Offer[][] = [];
  const legLive: boolean[] = [];
  let liveFlights = false;
  let liveHotels = false;
  let searchFailure: FlightSearchFailure | undefined;
  let liveSearchEmpty = false;
  const exact: Offer[] = [];
  const multiLegFlight = flightLegCount > 1;
  const liveEnabled = isLiveFlightSearchEnabled();
  const seedFlightsOk = allowSeedFlightFallback();

  for (let i = 0; i < searches.length; i++) {
    const leg = searches[i];
    const live = liveResults[i];

    if (leg.product === "FLIGHT" && live === null && liveEnabled) {
      searchFailure = searchFailure ?? "travelport_failed";
      legBuckets.push([]);
      legLive.push(false);
      continue;
    }

    if (live && live.length > 0) {
      let bucket = live;
      if (leg.product === "FLIGHT") liveFlights = true;
      if (leg.product === "HOTEL") {
        liveHotels = true;
        if (leg.query.hotelName) {
          const hits = live.filter(
            (o) => isHotel(o) && hotelNameMatches(o.name, leg.query.hotelName!),
          );
          if (hits.length > 0) bucket = hits;
        }
      }
      legBuckets.push(bucket);
      legLive.push(true);
      exact.push(...bucket);
      continue;
    }

    // Live flight search succeeded but returned zero offers — never substitute seed JSON.
    if (leg.product === "FLIGHT" && liveEnabled && Array.isArray(live) && live.length === 0) {
      liveSearchEmpty = true;
      legBuckets.push([]);
      legLive.push(true);
      continue;
    }

    // Multi-city: never substitute seed JSON — it breaks itinerary assembly and
    // hides real GDS gaps (e.g. London→Washington empty while PK→London is live).
    if (multiLegFlight && leg.product === "FLIGHT") {
      legBuckets.push([]);
      legLive.push(false);
      continue;
    }

    if (leg.product === "FLIGHT" && !seedFlightsOk) {
      legBuckets.push([]);
      legLive.push(false);
      continue;
    }

    const seedIntent = intentFromSearchLeg(leg, intent);
    const seed = search(intentToQuery(seedIntent));
    const seedExact =
      leg.product === "FLIGHT" ? seed.exact.filter(isFlight) : seed.exact.filter(isHotel);
    const fallback = seedExact.length > 0 ? seedExact : seed.exact;
    legBuckets.push(fallback);
    legLive.push(false);
    exact.push(...fallback);
  }

  let legWeb: boolean[] = searches.map(() => false);

  if (
    multiLegFlight &&
    isWebMetaConfigured() &&
    searches.some((s, i) => s.product === "FLIGHT" && (legBuckets[i]?.length ?? 0) === 0)
  ) {
    const filled = await fillEmptyFlightLegsFromWeb({
      searches,
      legBuckets,
      legLive,
      currency: (currency ?? "USD").toUpperCase().slice(0, 3),
    });
    for (let i = 0; i < searches.length; i++) {
      if (!filled.legWeb[i]) continue;
      legBuckets[i] = filled.legBuckets[i];
      legWeb[i] = true;
      exact.push(...filled.legBuckets[i]);
    }
  }

  if (plan.includePackages || intent.type === "package") {
    const pkgSeed = search(
      intentToQuery({
        ...intent,
        type: "package",
        origin: intent.origin,
        destination: intent.destination,
      }),
    );
    const pkgs = [...pkgSeed.exact, ...pkgSeed.alternatives].filter(isPackage);
    if (pkgs.length > 0) {
      exact.push(...pkgs);
      legBuckets.push(pkgs);
    }
  }

  const seedAll = search(intentToQuery(intent));
  const exactIds = new Set(exact.map((o) => o.id));
  const alternatives = [...seedAll.exact, ...seedAll.alternatives].filter((o) => {
    if (exactIds.has(o.id)) return false;
    if (liveEnabled && isFlight(o)) return false;
    return true;
  });

  return {
    exact,
    alternatives,
    liveFlights,
    liveHotels,
    legs: searches.length > 1 || plan.includePackages ? legBuckets : undefined,
    legLive: searches.length > 1 ? legLive : undefined,
    legWeb: searches.length > 1 ? legWeb : undefined,
    ...(searchFailure ? { searchFailure } : {}),
    ...(liveSearchEmpty ? { liveSearchEmpty: true } : {}),
  };
}

export async function retrieveSeedPackages(
  intent: ExtractedIntent,
  location: TravellerLocation | null,
): Promise<RetrieveResult> {
  const originPlace =
    intent.origin || location?.place || location?.city || DEFAULT_ORIGIN_PLACE;
  const seed = search(
    intentToQuery({
      ...intent,
      type: "package",
      origin: originPlace,
    }),
  );
  let exact = [...seed.exact].filter(isPackage);
  if (exact.length === 0) {
    exact = [...seed.exact, ...seed.alternatives].filter(isPackage);
  }

  const dest = intent.destination;
  const alts: Offer[] = [];
  let liveFlights = false;
  let liveHotels = false;
  if (dest && placeToIata(dest)) {
    const pax = intent.passengers ?? 1;
    const flights = await searchLiveFlights({
      origin: originPlace,
      destination: dest,
      cabin: intent.cabin,
      passengers: pax,
      departureDate: intent.departureDate,
      returnDate: intent.returnDate,
      currency: location?.currency,
      preferredCarriers: intent.filters?.preferredAirlines,
    });
    if (flights?.length) {
      liveFlights = true;
      alts.push(...flights.slice(0, 3));
    }
    const hotels = await searchLiveHotels({
      city: dest,
      minStars: intent.minStars,
      guests: Math.max(2, pax),
      rooms: 1,
      currency: location?.currency,
      checkInDate: intent.departureDate,
      checkOutDate: intent.returnDate,
    });
    if (hotels?.length) {
      liveHotels = true;
      alts.push(...hotels.slice(0, 3));
    }
  }

  if (exact.length === 0 && alts.length > 0) {
    return {
      exact: alts,
      alternatives: seed.alternatives,
      liveFlights,
      liveHotels,
    };
  }

  return {
    exact,
    alternatives: [...alts, ...seed.alternatives.filter((o) => !isPackage(o))],
    liveFlights,
    liveHotels,
  };
}

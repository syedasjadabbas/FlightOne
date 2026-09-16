import { searchLiveFlights } from "@/lib/inventory/liveFlights";
import { iataToPlace, isKnownIata } from "@/lib/inventory/places";
import type { FlightOffer } from "@/lib/inventory/types";
import { airlineMatchesPreference } from "@/lib/consultant/airlines";
import {
  openMarketAlreadyDiverse,
} from "@/lib/inventory/searchFlightsPreferred";
import { altAirports } from "./altAirports";
import {
  collapseMetroLookalikeFlights,
  tagNearbyAirportFlights,
} from "./collapseMetroLookalikes";
import { isSerpConfigured } from "./serpHotels";
import { searchGoogleFlights } from "./serpFlights";

export type IndicativeFlightComp = {
  label: string;
  airlines: string;
  otaPriceLabel: string | null;
  why: string;
};

export type FlightCompsBundle = {
  primaryOrigin: string;
  primaryDestination: string;
  preferredAirlines: string[];
  preferredFoundOnGds: boolean;
  /** Preferred is within ~8% of the cheapest bookable we found. */
  preferredCompetitive: boolean;
  googleLowestMajor: number | null;
  googleCurrency: string | null;
  /** Our cheapest primary-route GDS fare sits above Google's lowest by >5%. */
  gdsUndercutByGoogle: boolean;
  altAirportRoutes: string[];
  indicative: IndicativeFlightComp[];
};

export type FlightCompsQuery = {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate?: string;
  currency: string;
  cabin?: "economy" | "premium" | "business";
  passengers?: number;
  preferredAirlines?: string[];
};

export type FlightCompsResolveResult = {
  bundle: FlightCompsBundle;
  bookable: FlightOffer[];
};

function dedupeFlights(offers: FlightOffer[]): FlightOffer[] {
  const seen = new Set<string>();
  const out: FlightOffer[] = [];
  for (const o of offers) {
    const key = `${o.originCode}-${o.destinationCode}-${o.airline}-${o.stops}-${o.departTimeLocal}-${o.netFare.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

function formatMajor(price: number | null, currency: string): string | null {
  if (price == null) return null;
  return `${currency} ${Math.round(price).toLocaleString("en-US")}`;
}

/**
 * Primary GDS route + nearby airport legs + Google Flights intel.
 * Cards stay Travelport-only; Serp prices are indicative for Ava's pitch.
 */
export async function resolveFlightComps(
  q: FlightCompsQuery,
): Promise<FlightCompsResolveResult | null> {
  const origin = q.originIata.toUpperCase();
  const dest = q.destinationIata.toUpperCase();
  const currency = q.currency.toUpperCase().slice(0, 3);
  const preferred = (q.preferredAirlines || []).map((c) => c.toUpperCase());
  const originPlace = iataToPlace(origin);
  const destPlace = iataToPlace(dest);

  const primary =
    (await searchLiveFlights({
      origin: originPlace,
      destination: destPlace,
      cabin: q.cabin,
      passengers: q.passengers ?? 1,
      departureDate: q.departureDate,
      returnDate: q.returnDate,
      currency,
      preferredCarriers: preferred,
    })) || [];

  // Nearby airports — dest alts first (LGW/STN for London), then origin alts.
  //
  // max=3 (not 2): a customer asking for "return can be from any city in
  // UAE" needs DWC, SHJ AND AUH all considered — METRO_AIRPORTS.DXB lists
  // all three, but a max of 2 silently dropped Abu Dhabi (the fourth entry)
  // every time, which was exactly the reported bug ("return can be from any
  // city from UAE" only ever considered Dubai itself, or at best Dubai +
  // one alternate). This is real Travelport search fan-out, not a label —
  // each alt pair gets its own live searchLiveFlights call below.
  //
  // Skip when primary open market is already carrier-diverse: alt probes
  // (LHR→OAK/SJC, LGW→SFO) dominated open-jaw latency without improving
  // curation when SFO/LHR already returned 3+ airlines.
  const destAlts = altAirports(dest, 3).filter(isKnownIata);
  const originAlts = altAirports(origin, 1).filter(isKnownIata);
  const skipAltProbes =
    primary.length > 0 && openMarketAlreadyDiverse(primary);
  const altPairs: { o: string; d: string }[] = skipAltProbes
    ? []
    : [
        ...destAlts.map((d) => ({ o: origin, d })),
        ...originAlts.map((o) => ({ o, d: dest })),
      ].filter(
        (p) =>
          !(p.o === origin && p.d === dest) &&
          isKnownIata(p.o) &&
          isKnownIata(p.d),
      );

  // Cap raised from 3→4 to match: destAlts alone can now contribute 3 pairs
  // (DWC/SHJ/AUH), and the old cap of 3 would have silently dropped the
  // origin-side alternate every time destAlts filled all 3 slots first.
  const altResults = await Promise.all(
    altPairs.slice(0, 4).map(async (p) => {
      const flights = await searchLiveFlights({
        origin: iataToPlace(p.o),
        destination: iataToPlace(p.d),
        cabin: q.cabin,
        passengers: q.passengers ?? 1,
        departureDate: q.departureDate,
        returnDate: q.returnDate,
        currency,
        preferredCarriers: preferred,
      });
      return { pair: p, flights: flights || [] };
    }),
  );

  const altBookable = tagNearbyAirportFlights(
    altResults.flatMap((r) => r.flights),
    origin,
    dest,
  );
  const altAirportRoutes = altResults
    .filter((r) => r.flights.length > 0)
    .map((r) => `${r.pair.o}→${r.pair.d}`);

  let serpOptions: Awaited<ReturnType<typeof searchGoogleFlights>> = {
    options: [],
    lowestPriceMajor: null,
  };

  if (isSerpConfigured()) {
    // One market search — filter preferred carriers locally. Serp's
    // include_airlines often returns empty on otherwise valid routes.
    serpOptions = await searchGoogleFlights({
      origin,
      destination: dest,
      outboundDate: q.departureDate,
      returnDate: q.returnDate,
      currency,
      adults: q.passengers ?? 1,
    });
  }

  const serpPreferredOptions = preferred.length
    ? serpOptions.options.filter(
        (o) =>
          (o.carrierHint && preferred.includes(o.carrierHint)) ||
          o.airlines.some((name) => airlineMatchesPreference(name, preferred)),
      )
    : [];
  const serpPreferredLowest = serpPreferredOptions.reduce<number | null>((min, o) => {
    if (o.priceMajor == null) return min;
    if (min == null || o.priceMajor < min) return o.priceMajor;
    return min;
  }, null);

  const preferredOnGds = primary.filter((f) =>
    airlineMatchesPreference(f.airline, preferred),
  );
  const preferredFoundOnGds = preferred.length > 0 && preferredOnGds.length > 0;

  const allBookable = collapseMetroLookalikeFlights(
    dedupeFlights([...primary, ...altBookable]),
    dest,
    origin,
  ).filter((o): o is FlightOffer => o.type === "flight");
  const cheapestMinor = allBookable.reduce(
    (min, f) => Math.min(min, f.netFare.amount),
    Number.POSITIVE_INFINITY,
  );
  const preferredCheapest = preferredOnGds.reduce(
    (min, f) => Math.min(min, f.netFare.amount),
    Number.POSITIVE_INFINITY,
  );
  const preferredCompetitive =
    preferredFoundOnGds &&
    Number.isFinite(preferredCheapest) &&
    Number.isFinite(cheapestMinor) &&
    preferredCheapest <= cheapestMinor * 1.08;

  const primaryCheapestMinor = primary.reduce(
    (min, f) => Math.min(min, f.netFare.amount),
    Number.POSITIVE_INFINITY,
  );
  const googleLowest =
    serpPreferredLowest ?? serpOptions.lowestPriceMajor;
  const gdsUndercutByGoogle =
    Number.isFinite(primaryCheapestMinor) &&
    googleLowest != null &&
    primaryCheapestMinor / 100 > googleLowest * 1.05;

  // Rank: preferred first if competitive; then cheapest overall; keep alt airports visible.
  let bookable: FlightOffer[] = [];
  if (preferred.length > 0) {
    if (preferredCompetitive) {
      bookable = [
        ...preferredOnGds.sort((a, b) => a.netFare.amount - b.netFare.amount),
        ...allBookable
          .filter((f) => !airlineMatchesPreference(f.airline, preferred))
          .sort((a, b) => a.netFare.amount - b.netFare.amount),
      ];
    } else {
      // Courtesy preferred (if any) + cheaper others first.
      const others = allBookable
        .filter((f) => !airlineMatchesPreference(f.airline, preferred))
        .sort((a, b) => a.netFare.amount - b.netFare.amount);
      bookable = [...preferredOnGds.slice(0, 1), ...others];
    }
  } else {
    bookable = [...allBookable].sort((a, b) => a.netFare.amount - b.netFare.amount);
  }
  bookable = dedupeFlights(bookable).slice(0, 5);

  if (bookable.length === 0 && !isSerpConfigured()) return null;
  if (bookable.length === 0 && serpOptions.options.length === 0) return null;

  const indicative: IndicativeFlightComp[] = serpOptions.options.slice(0, 4).map((o) => ({
    label: `${o.departureId || origin}→${o.arrivalId || dest}`,
    airlines: o.airlines.join(" / ") || o.carrierHint || "mixed",
    otaPriceLabel: formatMajor(o.priceMajor, o.currency || currency),
    why:
      preferred.length && o.carrierHint && preferred.includes(o.carrierHint)
        ? "matches preferred carrier on Google Flights"
        : "Google Flights market reference",
  }));

  if (serpPreferredOptions[0] && preferred.length) {
    const top = serpPreferredOptions[0];
    indicative.unshift({
      label: `${origin}→${dest} (${preferred.join("/")})`,
      airlines: top.airlines.join(" / ") || preferred.join("/"),
      otaPriceLabel: formatMajor(top.priceMajor, top.currency || currency),
      why: "preferred airline on Google Flights (indicative)",
    });
  }

  return {
    bundle: {
      primaryOrigin: origin,
      primaryDestination: dest,
      preferredAirlines: preferred,
      preferredFoundOnGds,
      preferredCompetitive,
      googleLowestMajor: googleLowest,
      googleCurrency: currency,
      gdsUndercutByGoogle,
      altAirportRoutes,
      indicative: indicative.slice(0, 5),
    },
    bookable,
  };
}

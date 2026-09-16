/**
 * Kayak-style web meta-search fallback for empty GDS flight legs.
 * Google Flights (SerpAPI) fills indicative, non-bookable offers when Travelport returns none.
 */
import { airlineDisplayName } from "@/lib/consultant/airlines";
import { iataToPlace } from "@/lib/inventory/places";
import type { FlightSearchQuery, SupplierSearchBody } from "@/lib/inventory/supplierSearch";
import { isFlight, type FlightOffer, type FlightSegment, type Offer } from "@/lib/inventory/types";
import { isSerpConfigured } from "./serpHotels";
import { searchGoogleFlights, type SerpFlightOption } from "./serpFlights";

export function isWebMetaConfigured(): boolean {
  return isSerpConfigured();
}

export function isWebMetaOffer(offer: Offer): boolean {
  return isFlight(offer) && offer.tags.includes("web-meta");
}

/** Strip web-meta offers before GDS itinerary combiner (MVP — no fake combined tickets). */
export function bucketsForGdsPipeline(buckets: Offer[][]): Offer[][] {
  return buckets.map((bucket) => bucket.filter((o) => !isWebMetaOffer(o)));
}

function majorToMinor(priceMajor: number | null, currency: string): { amount: number; currency: string } {
  const ccy = currency.toUpperCase().slice(0, 3);
  if (priceMajor == null || priceMajor <= 0) {
    return { amount: 0, currency: ccy };
  }
  return { amount: Math.round(priceMajor * 100), currency: ccy };
}

function mapSerpSegments(
  segments: NonNullable<SerpFlightOption["segments"]>,
  departureDate: string,
): FlightSegment[] {
  return segments.map((s) => ({
    carrier: s.carrier,
    flightNumber: s.flightNumber,
    originCode: s.originCode,
    destinationCode: s.destinationCode,
    departureDate,
    departTimeLocal: s.departTimeLocal || "00:00",
    arrivalDate: departureDate,
    arriveTimeLocal: s.arriveTimeLocal || "00:00",
    durationMinutes: s.durationMinutes ?? null,
  }));
}

export function serpOptionsToFlightOffers(
  opts: SerpFlightOption[],
  legQuery: FlightSearchQuery,
  currency: string,
): FlightOffer[] {
  const originCode = legQuery.origin.toUpperCase();
  const destinationCode = legQuery.destination.toUpperCase();
  const ccy = currency.toUpperCase().slice(0, 3);

  return opts.map((opt, index) => {
    const fare = majorToMinor(opt.priceMajor, opt.currency || ccy);
    const carrierRaw = opt.carrierHint || opt.airlines[0] || "XX";
    const segments = opt.segments?.length
      ? mapSerpSegments(opt.segments, legQuery.departureDate)
      : undefined;
    const firstSeg = segments?.[0];
    const lastSeg = segments?.[segments.length - 1];

    return {
      id: `web-${originCode}-${destinationCode}-${index}-${carrierRaw.slice(0, 2).toUpperCase()}`,
      type: "flight",
      supplier: "Google Flights",
      origin: iataToPlace(originCode),
      originCode,
      destination: iataToPlace(destinationCode),
      destinationCode,
      airline: airlineDisplayName(carrierRaw),
      cabin: "economy",
      stops: opt.stops ?? 0,
      durationMinutes: opt.durationMinutes ?? 0,
      departTimeLocal: firstSeg?.departTimeLocal || "00:00",
      ...(lastSeg?.arriveTimeLocal ? { arriveTimeLocal: lastSeg.arriveTimeLocal } : {}),
      departureDate: legQuery.departureDate,
      ...(firstSeg?.flightNumber ? { flightNumber: firstSeg.flightNumber } : {}),
      ...(segments ? { segments } : {}),
      unitsLeft: 0,
      netFare: fare,
      marketPrice: fare,
      tags: ["indicative", "web-meta", "not-bookable"],
    };
  });
}

function isEmptyFlightBucket(bucket: Offer[]): boolean {
  return bucket.length === 0 || !bucket.some(isFlight);
}

export async function fillEmptyFlightLegsFromWeb(args: {
  searches: SupplierSearchBody[];
  legBuckets: Offer[][];
  legLive: boolean[];
  currency: string;
}): Promise<{ legBuckets: Offer[][]; legWeb: boolean[] }> {
  const legBuckets = args.legBuckets.map((bucket) => [...bucket]);
  const legWeb = args.searches.map(() => false);

  if (!isWebMetaConfigured()) {
    return { legBuckets, legWeb };
  }

  await Promise.all(
    args.searches.map(async (search, index) => {
      if (search.product !== "FLIGHT") return;
      if (args.legLive[index]) return;
      if (!isEmptyFlightBucket(legBuckets[index] ?? [])) return;

      const { query } = search;
      const quoteCurrency = query.requestedCurrency || args.currency;
      const { options } = await searchGoogleFlights({
        origin: query.origin,
        destination: query.destination,
        outboundDate: query.departureDate,
        returnDate: query.returnDate,
        currency: quoteCurrency,
        adults: query.passengers,
      });

      if (options.length === 0) return;

      legBuckets[index] = serpOptionsToFlightOffers(options.slice(0, 8), query, quoteCurrency);
      legWeb[index] = true;
    }),
  );

  return { legBuckets, legWeb };
}

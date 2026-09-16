/**
 * Routed flight search: connecting inventory + nearby airports + hub stitches.
 *
 * Many GDS open results already include stops (e.g. LHE→IAD via AUH). When the
 * exact city pair is empty (common for secondary US cities like ORF), we:
 *  1) Retry nearby metro / gateway airports (IAD/DCA/BWI for Norfolk).
 *  2) If still empty, stitch O→hub + hub→D as a multi-ticket journey offer.
 */
import { addDaysIso, iataToPlace, isKnownIata } from "@/lib/inventory/places";
import { airportsForMetro, sameMetro } from "@/lib/comps/altAirports";
import { searchFlightsPreferredThenOpen } from "./searchFlightsPreferred";
import type { FlightOffer, FlightSegment, Offer } from "./types";
import { isFlight } from "./types";
import type { FlightSearchQuery } from "./supplierSearch";

/** Hubs tried when exact + nearby still empty (order ≈ PK leisure reach). */
const ROUTING_HUBS = [
  "AUH",
  "DXB",
  "DOH",
  "IST",
  "LHR",
  "FRA",
  "JFK",
  "EWR",
  "IAD",
  "ORD",
  "DEL",
  "BKK",
] as const;

const MAX_NEARBY = 3;
const MAX_HUBS = 3;
const MAX_STITCHED = 6;

function searchableIata(code: string): boolean {
  return isKnownIata(code);
}

export async function searchFlightsWithRouting(
  query: FlightSearchQuery,
  preferredCarriers?: string[],
): Promise<Offer[] | null> {
  const primary = await searchFlightsPreferredThenOpen(query, preferredCarriers);
  if (primary && primary.length > 0) return primary;

  const nearby = await searchNearbyGateways(query, preferredCarriers);
  if (nearby.length > 0) return nearby;

  const stitched = await searchViaHubs(query, preferredCarriers);
  return stitched.length > 0 ? stitched : primary;
}

async function searchNearbyGateways(
  query: FlightSearchQuery,
  preferredCarriers?: string[],
): Promise<FlightOffer[]> {
  const origin = query.origin.toUpperCase();
  const dest = query.destination.toUpperCase();
  const destAlts = airportsForMetro(dest)
    .filter((c) => c !== dest && searchableIata(c))
    .slice(0, MAX_NEARBY);
  const originAlts = airportsForMetro(origin)
    .filter((c) => c !== origin && searchableIata(c))
    .slice(0, 1);

  const jobs: { origin: string; destination: string }[] = [
    ...destAlts.map((destination) => ({ origin, destination })),
    ...originAlts.map((o) => ({ origin: o, destination: dest })),
  ].filter((j) => searchableIata(j.origin) && searchableIata(j.destination));

  if (jobs.length === 0) return [];

  const batches = await Promise.all(
    jobs.map((j) =>
      searchFlightsPreferredThenOpen(
        { ...query, origin: j.origin, destination: j.destination },
        preferredCarriers,
      ),
    ),
  );

  const out: FlightOffer[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < batches.length; i++) {
    const job = jobs[i];
    for (const o of batches[i] || []) {
      if (!isFlight(o) || seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(tagRouted(o, {
        viaNearby: true,
        requestedDestination: dest,
        servedAirport: job.destination,
      }));
    }
  }
  return out;
}

async function searchViaHubs(
  query: FlightSearchQuery,
  preferredCarriers?: string[],
): Promise<FlightOffer[]> {
  const origin = query.origin.toUpperCase();
  const dest = query.destination.toUpperCase();
  const hubs = ROUTING_HUBS.filter(
    (h) =>
      searchableIata(h) &&
      h !== origin &&
      h !== dest &&
      !sameMetro(h, origin) &&
      !sameMetro(h, dest),
  ).slice(0, MAX_HUBS);

  const stitched: FlightOffer[] = [];
  for (const hub of hubs) {
    const firstLeg = await searchFlightsPreferredThenOpen(
      { ...query, destination: hub },
      preferredCarriers,
    );
    if (!firstLeg?.length) continue;

    // Date the second hop after the best first-leg arrival (or next day).
    const dateByOffer = (o: Offer): string => {
      if (!isFlight(o)) return query.departureDate;
      const last = o.segments?.[o.segments.length - 1];
      return last?.arrivalDate || o.departureDate || query.departureDate;
    };

    const secondByDate = new Map<string, FlightOffer[]>();
    for (const o of firstLeg.filter(isFlight).slice(0, 3)) {
      const arrive = dateByOffer(o);
      const secondDate = arrive;
      const nextDate = addDaysIso(arrive, 1);
      for (const d of [secondDate, nextDate]) {
        if (secondByDate.has(d)) continue;
        const batch = await searchFlightsPreferredThenOpen(
          { ...query, origin: hub, destination: dest, departureDate: d },
          preferredCarriers,
        );
        secondByDate.set(d, (batch || []).filter(isFlight));
      }
    }

    for (const a of firstLeg.filter(isFlight).slice(0, 3)) {
      const arrive = dateByOffer(a);
      const candidates = [
        ...(secondByDate.get(arrive) || []),
        ...(secondByDate.get(addDaysIso(arrive, 1)) || []),
      ];
      for (const b of candidates.slice(0, 3)) {
        if (!canConnect(a, b)) continue;
        const combo = stitchFlights(a, b, { hub, requestedDestination: dest });
        if (combo) stitched.push(combo);
        if (stitched.length >= MAX_STITCHED) return stitched;
      }
    }
  }
  return stitched;
}

function canConnect(a: FlightOffer, b: FlightOffer): boolean {
  if (!sameMetro(a.destinationCode, b.originCode) && a.destinationCode !== b.originCode) {
    return false;
  }
  const arrive = a.segments?.[a.segments.length - 1]?.arrivalDate || a.departureDate;
  const leave = b.segments?.[0]?.departureDate || b.departureDate;
  if (arrive && leave && leave < arrive) return false;
  return true;
}

function mergeOptionalRefundable(a?: boolean, b?: boolean): boolean | undefined {
  if (a == null && b == null) return undefined;
  if (a == null) return b;
  if (b == null) return a;
  return a && b;
}

function mergeOptionalBaggage(a?: number, b?: number): number | undefined {
  if (a == null && b == null) return undefined;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function stitchFlights(
  a: FlightOffer,
  b: FlightOffer,
  meta: { hub: string; requestedDestination: string },
): FlightOffer | null {
  if (a.netFare.currency !== b.netFare.currency) return null;
  const segsA = a.segments?.length
    ? a.segments
    : ([
        {
          carrier: a.airline.slice(0, 2).toUpperCase(),
          flightNumber: a.flightNumber || a.airline,
          originCode: a.originCode,
          destinationCode: a.destinationCode,
          departureDate: a.departureDate || "",
          departTimeLocal: a.departTimeLocal,
          arrivalDate: a.departureDate || "",
          arriveTimeLocal: a.arriveTimeLocal || a.departTimeLocal,
          durationMinutes: a.durationMinutes,
        },
      ] satisfies FlightSegment[]);
  const segsB = b.segments?.length
    ? b.segments
    : ([
        {
          carrier: b.airline.slice(0, 2).toUpperCase(),
          flightNumber: b.flightNumber || b.airline,
          originCode: b.originCode,
          destinationCode: b.destinationCode,
          departureDate: b.departureDate || "",
          departTimeLocal: b.departTimeLocal,
          arrivalDate: b.departureDate || "",
          arriveTimeLocal: b.arriveTimeLocal || b.departTimeLocal,
          durationMinutes: b.durationMinutes,
        },
      ] satisfies FlightSegment[]);

  // Layover between tickets (rough calendar; detailed MCT is Phase-8).
  const lastA = segsA[segsA.length - 1];
  if (lastA) {
    const leave = segsB[0]?.departureDate;
    const arrive = lastA.arrivalDate;
    if (arrive && leave) {
      const nights =
        (Date.parse(`${leave}T12:00:00Z`) - Date.parse(`${arrive}T12:00:00Z`)) /
        86_400_000;
      if (Number.isFinite(nights) && nights >= 0) {
        lastA.layoverMinutesAfter = Math.round(nights * 24 * 60);
      }
    }
  }

  const netAmount = a.netFare.amount + b.netFare.amount;
  const marketAmount = a.marketPrice.amount + b.marketPrice.amount;
  const duration = (a.durationMinutes || 0) + (b.durationMinutes || 0);
  const stops = Math.max(0, segsA.length + segsB.length - 1);

  return {
    id: `stitch-${a.id}__${b.id}`,
    type: "flight",
    supplier: a.supplier,
    origin: a.origin,
    originCode: a.originCode,
    destination: iataToPlace(b.destinationCode),
    destinationCode: b.destinationCode,
    airline: a.airline === b.airline ? a.airline : `${a.airline} + ${b.airline}`,
    cabin: a.cabin,
    stops,
    durationMinutes: duration,
    departTimeLocal: a.departTimeLocal,
    arriveTimeLocal: b.arriveTimeLocal,
    departureDate: a.departureDate,
    flightNumber: a.flightNumber,
    aircraft: a.aircraft,
    segments: [...segsA, ...segsB],
    ...(mergeOptionalRefundable(a.refundable, b.refundable) != null
      ? { refundable: mergeOptionalRefundable(a.refundable, b.refundable) }
      : {}),
    ...(mergeOptionalBaggage(a.baggageKg, b.baggageKg) != null
      ? { baggageKg: mergeOptionalBaggage(a.baggageKg, b.baggageKg) }
      : {}),
    ...(typeof a.airlineScore === "number" &&
    typeof b.airlineScore === "number" &&
    Number.isFinite(a.airlineScore) &&
    Number.isFinite(b.airlineScore)
      ? { airlineScore: Math.round((a.airlineScore + b.airlineScore) / 2) }
      : {}),
    ...(typeof a.supplierReliability === "number" &&
    typeof b.supplierReliability === "number" &&
    Number.isFinite(a.supplierReliability) &&
    Number.isFinite(b.supplierReliability)
      ? {
          supplierReliability: Math.min(a.supplierReliability, b.supplierReliability),
        }
      : typeof a.supplierReliability === "number" && Number.isFinite(a.supplierReliability)
        ? { supplierReliability: a.supplierReliability }
        : typeof b.supplierReliability === "number" && Number.isFinite(b.supplierReliability)
          ? { supplierReliability: b.supplierReliability }
          : {}),
    unitsLeft:
      a.unitsLeft != null && b.unitsLeft != null
        ? Math.min(a.unitsLeft, b.unitsLeft)
        : a.unitsLeft ?? b.unitsLeft,
    netFare: { amount: netAmount, currency: a.netFare.currency },
    marketPrice: { amount: marketAmount, currency: a.marketPrice.currency },
    tags: [
      "live",
      "travelport",
      "gds",
      "hub-stitched",
      `via-${meta.hub}`,
      `requested-${meta.requestedDestination}`,
    ],
  };
}

function tagRouted(
  offer: FlightOffer,
  meta: {
    viaNearby: boolean;
    requestedDestination: string;
    servedAirport: string;
  },
): FlightOffer {
  const tags = new Set(offer.tags);
  if (meta.viaNearby) tags.add("nearby-airport");
  tags.add(`requested-${meta.requestedDestination}`);
  tags.add(`served-${meta.servedAirport}`);
  return { ...offer, tags: [...tags] };
}

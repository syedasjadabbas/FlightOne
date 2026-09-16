import { addMoney, minor, type Money } from "@/types/money";
import type { PricedOffer } from "@/lib/pricing/pricing";
import { isFlight, type FlightOffer } from "@/lib/inventory/types";
import { sameMetro } from "@/lib/comps/altAirports";
import type { PlanningTravelPlan } from "@/lib/travel-planner/types";
import type { ItineraryCandidate } from "./types";
import { calendarNightsBetween } from "./stay";

const DEFAULT_BEAM = 8;

function asFlight(p: PricedOffer): FlightOffer | null {
  return isFlight(p.offer) ? p.offer : null;
}

function arriveDate(o: FlightOffer): string {
  const segs = o.segments;
  if (segs?.length) {
    const last = segs[segs.length - 1];
    if (last.arrivalDate) return last.arrivalDate;
  }
  return o.departureDate || "";
}

function departDate(o: FlightOffer): string {
  if (o.segments?.[0]?.departureDate) return o.segments[0].departureDate;
  return o.departureDate || "";
}

function continuaAirport(prevDest: string, nextOrigin: string): boolean {
  if (prevDest === nextOrigin) return true;
  return sameMetro(prevDest, nextOrigin);
}

function sumMoney(parts: Money[]): Money | null {
  if (!parts.length) return null;
  const currency = parts[0].currency;
  if (parts.some((p) => p.currency !== currency)) return null;
  return parts.reduce((acc, p) => addMoney(acc, p));
}

function metricsFor(offers: PricedOffer[]): ItineraryCandidate["metrics"] {
  let totalDurationMinutes = 0;
  let totalStops = 0;
  let longestLayoverMinutes = 0;
  let overnightConnections = 0;

  const flights = offers.map(asFlight).filter((f): f is FlightOffer => f != null);
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    totalDurationMinutes += f.durationMinutes || 0;
    totalStops += f.stops;
    if (f.segments) {
      for (const s of f.segments) {
        if ((s.layoverMinutesAfter ?? 0) > longestLayoverMinutes) {
          longestLayoverMinutes = s.layoverMinutesAfter ?? 0;
        }
      }
    }
    if (i > 0) {
      const prev = flights[i - 1];
      const nights = calendarNightsBetween(arriveDate(prev), departDate(f));
      if (nights != null && nights >= 1) overnightConnections += 1;
    }
  }

  return {
    totalDurationMinutes,
    totalStops,
    longestLayoverMinutes,
    overnightConnections,
  };
}

function buildTotals(offers: PricedOffer[]): {
  totalCustomerPrice: Money;
  totalNetFare: Money;
  totalMarginMinor: number;
  currency: string;
} | null {
  const customer = sumMoney(offers.map((o) => o.customerPrice));
  const net = sumMoney(offers.map((o) => o.offer.netFare));
  if (!customer || !net) return null;
  return {
    totalCustomerPrice: customer,
    totalNetFare: net,
    totalMarginMinor: offers.reduce((s, o) => s + o.marginMinor, 0),
    currency: customer.currency,
  };
}

function candidateFrom(
  offers: PricedOffer[],
  construction: ItineraryCandidate["ticketing"]["construction"],
  id: string,
): ItineraryCandidate | null {
  const totals = buildTotals(offers);
  if (!totals) return null;
  const risk: ItineraryCandidate["ticketing"]["risk"] =
    construction === "single_ticket"
      ? "low"
      : offers.length >= 4
        ? "high"
        : "medium";

  return {
    id,
    offers,
    ...totals,
    constraints: { satisfied: true, violations: [] },
    metrics: metricsFor(offers),
    ticketing: { construction, risk },
  };
}

/**
 * Single GDS round-trip (or any lone priced flight): authoritative component.
 */
function singleOfferCandidates(bucket: PricedOffer[]): ItineraryCandidate[] {
  const out: ItineraryCandidate[] = [];
  for (const p of bucket.slice(0, DEFAULT_BEAM)) {
    const f = asFlight(p);
    if (!f) continue;
    const construction =
      f.returnDate || (f.returnSegments && f.returnSegments.length > 0)
        ? "single_ticket"
        : "multiple_tickets";
    const c = candidateFrom([p], construction, `itin-ow-${f.id}`);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Staged beam construction across flight offer buckets (one hop per stage).
 * Open-jaw plans intentionally allow a landside gap (e.g. arrive SFO, return from MCO).
 */
export function buildItineraries(
  buckets: PricedOffer[][],
  plan: PlanningTravelPlan,
  opts?: { beamWidth?: number },
): ItineraryCandidate[] {
  const beamWidth = opts?.beamWidth ?? DEFAULT_BEAM;
  const flightBuckets = buckets
    .map((b) => b.filter((p) => isFlight(p.offer)))
    .filter((b) => b.length > 0);
  const allowOpenJawGap = plan.tripType === "open_jaw";

  if (flightBuckets.length === 0) return [];
  if (flightBuckets.length === 1) return singleOfferCandidates(flightBuckets[0]);

  type Partial = { offers: PricedOffer[]; price: number; duration: number };

  let frontier: Partial[] = flightBuckets[0]
    .slice(0, beamWidth * 2)
    .map((p) => {
      const f = asFlight(p)!;
      return {
        offers: [p],
        price: p.customerPrice.amount,
        duration: f.durationMinutes || 0,
      };
    })
    .sort((a, b) => a.price - b.price || a.duration - b.duration)
    .slice(0, beamWidth);

  for (let stage = 1; stage < flightBuckets.length; stage++) {
    const nextBucket = flightBuckets[stage];
    const next: Partial[] = [];
    // For classic open-jaw (outbound + return), the only gap is between the
    // last outbound hop and the return; with exactly 2 stages that is stage 1.
    const gapOkHere = allowOpenJawGap && stage === flightBuckets.length - 1;

    for (const partial of frontier) {
      const prevFlight = asFlight(partial.offers[partial.offers.length - 1]);
      if (!prevFlight) continue;
      const prevDest = prevFlight.destinationCode;
      const prevArrive = arriveDate(prevFlight);

      for (const p of nextBucket) {
        const f = asFlight(p);
        if (!f) continue;
        if (!gapOkHere && !continuaAirport(prevDest, f.originCode)) continue;
        const nextDep = departDate(f);
        if (prevArrive && nextDep && nextDep < prevArrive) continue;

        next.push({
          offers: [...partial.offers, p],
          price: partial.price + p.customerPrice.amount,
          duration: partial.duration + (f.durationMinutes || 0),
        });
      }
    }

    frontier = next
      .sort((a, b) => a.price - b.price || a.duration - b.duration)
      .slice(0, beamWidth);

    if (!frontier.length) return [];
  }

  const out: ItineraryCandidate[] = [];
  let i = 0;
  for (const partial of frontier) {
    const c = candidateFrom(
      partial.offers,
      "multiple_tickets",
      `itin-mc-${++i}-${partial.offers.map((o) => o.offer.id).join("_")}`.slice(0, 120),
    );
    if (c) out.push(c);
  }
  return out;
}

/** Convenience for tests / empty totals. */
export function zeroMoney(currency = "PKR"): Money {
  return minor(0, currency);
}

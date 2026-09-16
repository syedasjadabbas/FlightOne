import { isFlight, type FlightOffer } from "@/lib/inventory/types";
import { minor, savings, savingsPct } from "@/types/money";
import type { ItineraryCandidate, ItineraryMarketComparison } from "@/lib/itinerary/types";
import type { PlanningTravelPlan } from "@/lib/travel-planner/types";
import { airlineIataCode } from "@/lib/consultant/airlines";

export type ItineraryAngle =
  | "best_value"
  | "cheapest"
  | "fastest"
  | "premium"
  | "recommended";

export interface ScoredItinerary {
  itinerary: ItineraryCandidate;
  score: number;
  reasons: string[];
  angle: ItineraryAngle;
}

export interface ItineraryScoreWeights {
  price: number;
  market: number;
  duration: number;
  stops: number;
  airline: number;
  ticketSafety: number;
  preference: number;
}

export const DEFAULT_ITINERARY_WEIGHTS: ItineraryScoreWeights = {
  price: 30,
  market: 20,
  duration: 15,
  stops: 10,
  airline: 10,
  ticketSafety: 5,
  preference: 10,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function flightComponents(c: ItineraryCandidate): FlightOffer[] {
  return c.offers
    .map((p) => (isFlight(p.offer) ? p.offer : null))
    .filter((f): f is FlightOffer => f != null);
}

/**
 * Itinerary market edge only when every component has a verified edge and
 * currencies align. Never sum percentage savings across legs.
 */
export function itineraryMarketComparison(
  c: ItineraryCandidate,
): ItineraryMarketComparison {
  const priced = c.offers;
  if (!priced.length || !priced.every((p) => p.hasMarketEdge)) {
    return { verified: false };
  }
  const currency = priced[0].customerPrice.currency;
  if (priced.some((p) => p.customerPrice.currency !== currency)) {
    return { verified: false };
  }
  if (priced.some((p) => p.offer.marketPrice.currency !== currency)) {
    return { verified: false };
  }
  const refMinor = priced.reduce((s, p) => s + p.offer.marketPrice.amount, 0);
  const referencePrice = minor(refMinor, currency);
  const save = savings(c.totalCustomerPrice, referencePrice);
  if (save.amount <= 0) return { verified: false, referencePrice };
  return {
    referencePrice,
    savings: save,
    savingsPct: savingsPct(c.totalCustomerPrice, referencePrice),
    verified: true,
    source: "component_market_sum",
  };
}

function scoreOne(
  c: ItineraryCandidate,
  pool: ItineraryCandidate[],
  plan: PlanningTravelPlan,
  weights: ItineraryScoreWeights,
): ScoredItinerary {
  const prices = pool.map((x) => x.totalCustomerPrice.amount);
  const cheapest = Math.min(...prices);
  const dearest = Math.max(...prices);
  const spread = Math.max(1, dearest - cheapest);
  const durations = pool.map((x) => x.metrics.totalDurationMinutes || 1);
  const fastest = Math.min(...durations);
  const slowest = Math.max(...durations);
  const durSpread = Math.max(1, slowest - fastest);

  const reasons: string[] = [];
  let score = 0;

  const priceScore =
    weights.price * (1 - (c.totalCustomerPrice.amount - cheapest) / spread);
  score += priceScore;
  if (c.totalCustomerPrice.amount === cheapest) {
    reasons.push("Lowest complete-trip price among validated candidates");
  }

  const market = itineraryMarketComparison(c);
  c.market = market;
  if (market.verified && market.savingsPct != null) {
    score += clamp(market.savingsPct * 1.5, 0, weights.market);
    reasons.push(`~${market.savingsPct}% under summed market references`);
  }

  const dur = c.metrics.totalDurationMinutes || 0;
  score += weights.duration * (1 - (dur - fastest) / durSpread);
  if (dur === fastest && pool.length > 1) {
    reasons.push("Fastest complete journey among validated candidates");
  }

  const stopPenalty = Math.min(c.metrics.totalStops, 6) / 6;
  score += weights.stops * (1 - stopPenalty);
  if (c.metrics.totalStops === 0) reasons.push("Non-stop throughout");

  const flights = flightComponents(c);
  const airlineScores = flights
    .map((f) => f.airlineScore)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  // Only apply airline quality when every flight hop has a real score — never
  // invent a 70 fallback for missing quality intelligence.
  if (airlineScores.length === flights.length && flights.length > 0) {
    const avgAirline =
      airlineScores.reduce((s, v) => s + v, 0) / airlineScores.length;
    score += (avgAirline / 100) * weights.airline;
  }

  if (c.ticketing.construction === "single_ticket") {
    score += weights.ticketSafety;
    reasons.push("Single-ticket construction");
  } else if (c.ticketing.risk === "low") {
    score += weights.ticketSafety * 0.6;
  } else if (c.ticketing.risk === "high") {
    score += weights.ticketSafety * 0.2;
    reasons.push("Multi-ticket journey — allow connection buffers");
  } else {
    score += weights.ticketSafety * 0.4;
  }

  // Soft preference match (airlines / nonstop).
  let pref = 0;
  const preferred = plan.filters?.preferredAirlines ?? [];
  if (preferred.length && flights.length) {
    const codes = preferred.map((a) => a.toUpperCase());
    const carrierHits = flights.filter((f) => {
      const code = airlineIataCode(f.airline || f.flightNumber || "").toUpperCase();
      return codes.some((c) => c === code || (f.flightNumber || "").toUpperCase().startsWith(c));
    });
    pref = (carrierHits.length / flights.length) * weights.preference;
    if (carrierHits.length) reasons.push("Matches preferred carrier on some hops");
  } else {
    pref = weights.preference * 0.5;
  }
  if (plan.filters?.nonstopOnly && c.metrics.totalStops === 0) {
    pref = weights.preference;
    reasons.push("Honours non-stop preference");
  }
  score += pref;

  if (c.constraints.satisfied) {
    reasons.push("All requested hard constraints satisfied");
  }

  return {
    itinerary: c,
    score: clamp(Math.round(score)),
    reasons: reasons.slice(0, 5),
    angle: "best_value",
  };
}

export function scoreItineraries(
  pool: ItineraryCandidate[],
  plan: PlanningTravelPlan,
  weights: ItineraryScoreWeights = DEFAULT_ITINERARY_WEIGHTS,
): ScoredItinerary[] {
  const valid = pool.filter((c) => c.constraints.satisfied);
  return valid
    .map((c) => scoreOne(c, valid, plan, weights))
    .sort((a, b) => b.score - a.score);
}

/**
 * Differentiated top-N complete itineraries (not individual hops).
 */
export function curateItineraries(
  pool: ItineraryCandidate[],
  plan: PlanningTravelPlan,
  n = 3,
  weights?: ItineraryScoreWeights,
): ScoredItinerary[] {
  if (!pool.length) return [];
  const ranked = scoreItineraries(pool, plan, weights);
  if (!ranked.length) return [];

  const chosen: ScoredItinerary[] = [];
  const take = (s: ScoredItinerary | undefined, angle: ItineraryAngle) => {
    if (!s) return;
    if (chosen.some((c) => c.itinerary.id === s.itinerary.id)) return;
    chosen.push({ ...s, angle });
  };

  take(ranked[0], "best_value");

  const cheapest = [...ranked].sort(
    (a, b) =>
      a.itinerary.totalCustomerPrice.amount - b.itinerary.totalCustomerPrice.amount,
  )[0];
  take(cheapest, "cheapest");

  const fastest = [...ranked].sort(
    (a, b) =>
      a.itinerary.metrics.totalDurationMinutes -
      b.itinerary.metrics.totalDurationMinutes,
  )[0];
  take(fastest, "fastest");

  for (const s of ranked) {
    if (chosen.length >= n) break;
    take(s, "recommended");
  }

  return chosen.slice(0, n);
}

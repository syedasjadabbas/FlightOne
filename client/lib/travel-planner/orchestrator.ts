import { priceAll, type PricedOffer } from "@/lib/pricing/pricing";
import type { Offer } from "@/lib/inventory/types";
import { isFlight } from "@/lib/inventory/types";
import { buildItineraries } from "@/lib/itinerary/builder";
import { filterValidItineraries } from "@/lib/itinerary/constraints";
import {
  curateItineraries,
  type ScoredItinerary,
} from "@/lib/recommendation/itineraryRecommendation";
import type { PlanningTravelPlan, SearchState } from "./types";
import { DEFAULT_SEARCH_BUDGET } from "./types";

export interface PlanningResult {
  itineraries: ScoredItinerary[];
  /** Hop inventory still useful as secondary context / UI cards. */
  legOffers: PricedOffer[][];
  searchState: SearchState;
  revalidated: boolean;
  candidatesBuilt: number;
  candidatesValid: number;
}

/** Phase-8 stub — pass through until GDS offer-build revalidation exists. */
export function passthroughRevalidate(
  itineraries: ScoredItinerary[],
): ScoredItinerary[] {
  return itineraries;
}

/**
 * Multi-leg planning engine: price → build → gate → score → curate.
 * Caller owns GDS retrieval; this owns journey assembly.
 */
export function runItineraryPipeline(
  plan: PlanningTravelPlan,
  legBuckets: Offer[][],
  opts?: { requestId?: string; beamWidth?: number },
): PlanningResult {
  const requestId = opts?.requestId ?? "local";
  const budget = DEFAULT_SEARCH_BUDGET;

  const pricedBuckets: PricedOffer[][] = legBuckets.map((bucket) => {
    const flights = bucket.filter(isFlight);
    return priceAll(flights).slice(0, budget.maxOffersPerTask);
  });

  const built = buildItineraries(pricedBuckets, plan, {
    beamWidth: opts?.beamWidth,
  });
  const valid = filterValidItineraries(built, plan);
  const curated = curateItineraries(valid, plan, 3);
  const itineraries = passthroughRevalidate(curated);

  const searchState: SearchState = {
    searchesPerformed: pricedBuckets.length,
    searchRounds: 1,
    executedSearchKeys: pricedBuckets.map((_, i) => `leg-${i}`),
  };

  console.info("[travel-planner] pipeline", {
    requestId,
    tripType: plan.tripType,
    legs: plan.legs.length,
    buckets: pricedBuckets.map((b) => b.length),
    candidatesBuilt: built.length,
    candidatesValid: valid.length,
    curated: itineraries.length,
    hardConstraints: plan.hardConstraints.length,
  });

  return {
    itineraries,
    legOffers: pricedBuckets,
    searchState,
    revalidated: false,
    candidatesBuilt: built.length,
    candidatesValid: valid.length,
  };
}

/** Flatten unique offers from curated itineraries for OfferCard UI. */
export function offersFromItineraries(
  itineraries: ScoredItinerary[],
  max = 6,
): PricedOffer[] {
  const seen = new Set<string>();
  const out: PricedOffer[] = [];
  for (const s of itineraries) {
    for (const p of s.itinerary.offers) {
      if (seen.has(p.offer.id)) continue;
      seen.add(p.offer.id);
      out.push(p);
      if (out.length >= max) return out;
    }
  }
  return out;
}

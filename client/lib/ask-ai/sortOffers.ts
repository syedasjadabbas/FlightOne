import type { OfferCard } from "@/lib/consultant/types";
import type { OfferAngle } from "@/lib/recommendation/recommendation";
import type { ResultsSortKey } from "./types";

const ANGLE_RANK: Record<OfferAngle, number> = {
  best_value: 0,
  recommended: 1,
  cheapest: 2,
  fastest: 3,
  premium: 4,
  top_rated: 5,
};

const ANGLE_SCORE: Record<OfferAngle, number> = {
  best_value: 100,
  recommended: 90,
  cheapest: 80,
  fastest: 70,
  premium: 60,
  top_rated: 50,
};

function totalFlightDurationMinutes(offer: OfferCard): number {
  if (!offer.flight) return Number.POSITIVE_INFINITY;
  const outbound = offer.flight.durationMinutes ?? 0;
  const inbound = offer.flight.returnDurationMinutes ?? 0;
  return outbound + inbound;
}

function compareOffers(
  a: OfferCard,
  b: OfferCard,
  sort: ResultsSortKey,
): number {
  switch (sort) {
    case "price":
      return a.priceMinor - b.priceMinor;
    case "duration":
      return totalFlightDurationMinutes(a) - totalFlightDurationMinutes(b);
    case "angle":
      return ANGLE_RANK[a.angle] - ANGLE_RANK[b.angle];
    case "score":
      return ANGLE_SCORE[a.angle] - ANGLE_SCORE[b.angle];
    default:
      return 0;
  }
}

/** Default sort direction — cheapest/fastest/best-first unless caller overrides. */
export function defaultSortAscending(sort: ResultsSortKey): boolean {
  switch (sort) {
    case "score":
      return false;
    case "price":
    case "duration":
    case "angle":
    default:
      return true;
  }
}

/** Stable client-side sort for the results rail. */
export function sortOffers(
  offers: OfferCard[],
  sort: ResultsSortKey,
  sortAscending?: boolean,
): OfferCard[] {
  const ascending = sortAscending ?? defaultSortAscending(sort);
  return [...offers]
    .map((offer, index) => ({ offer, index }))
    .sort((left, right) => {
      const cmp = compareOffers(left.offer, right.offer, sort);
      if (cmp !== 0) return ascending ? cmp : -cmp;
      return left.index - right.index;
    })
    .map(({ offer }) => offer);
}

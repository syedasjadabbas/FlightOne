import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import type { ResultsSortKey } from "@/lib/ask-ai/types";

export const SAMPLE_MAX = 3;
export const TRIPS_SAMPLE_MAX = 5;
/** Initial visible flight rows in the full results workspace (frontend slice only). */
export const WORKSPACE_PAGE = 12;
export const WORKSPACE_PAGE_STEP = 12;

export function itineraryDurationMinutes(it: ItinerarySummary): number {
  if (it.legs && it.legs.length > 0) {
    return it.legs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
  }
  return Number.POSITIVE_INFINITY;
}

export function sortItineraries(
  list: ItinerarySummary[],
  sortKey: ResultsSortKey,
): ItinerarySummary[] {
  const next = [...list];
  if (sortKey === "price") {
    next.sort((a, b) => a.totalPriceMinor - b.totalPriceMinor);
  } else if (sortKey === "duration") {
    next.sort((a, b) => itineraryDurationMinutes(a) - itineraryDurationMinutes(b));
  } else {
    next.sort((a, b) => {
      const aBoost = a.angle === "best_value" ? 1 : 0;
      const bBoost = b.angle === "best_value" ? 1 : 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      return b.score - a.score;
    });
  }
  return next;
}

/** Prefer server-curated Best / Cheapest / Fastest angles; sample badges only as fallback. */
export function applySampleBadges(offers: OfferCard[]): OfferCard[] {
  if (offers.length === 0) return offers;
  const hasCurated = offers.some(
    (o) => o.angle === "cheapest" || o.angle === "fastest",
  );
  if (hasCurated) return offers;

  const sample = offers.slice(0, Math.max(SAMPLE_MAX, 3));
  const minPrice = Math.min(...sample.map((o) => o.priceMinor ?? Number.POSITIVE_INFINITY));
  const atMin = sample.filter((o) => o.priceMinor === minPrice);
  const cheapestId = atMin.length === 1 ? atMin[0]?.id : undefined;
  const bestId = sample[0]?.id;
  return offers.map((o, i) => {
    if (i >= sample.length) return o;
    if (cheapestId && o.id === cheapestId && o.id !== bestId) {
      return { ...o, angle: "cheapest" };
    }
    if (o.id === bestId) {
      return { ...o, angle: o.angle === "cheapest" ? "cheapest" : "best_value" };
    }
    return o;
  });
}

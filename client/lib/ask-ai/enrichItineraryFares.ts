import type { OfferCard } from "@/lib/consultant/types";
import { buildItineraryKeyFromOfferCard } from "./itineraryKey";

/** Attach itinerary key + fare-count metadata without removing duplicate fares. */
export function enrichItineraryFares(offers: OfferCard[]): OfferCard[] {
  const withKeys = offers.map((offer) => {
    if (!offer.flight) return offer;
    const itineraryKey =
      offer.itineraryKey ??
      buildItineraryKeyFromOfferCard(
        offer.flight,
        offer.hubStitched ? ["hub-stitched"] : [],
      );
    return { ...offer, itineraryKey };
  });

  const fareCounts = new Map<string, number>();
  const minPriceMinor = new Map<string, number>();

  for (const offer of withKeys) {
    const key = offer.itineraryKey;
    if (!key) continue;
    fareCounts.set(key, (fareCounts.get(key) ?? 0) + 1);
    const prev = minPriceMinor.get(key);
    if (prev == null || offer.priceMinor < prev) {
      minPriceMinor.set(key, offer.priceMinor);
    }
  }

  return withKeys.map((offer) => {
    const key = offer.itineraryKey;
    if (!key) return offer;
    const faresOnItinerary = fareCounts.get(key) ?? 1;
    const lowestPriceMinor = minPriceMinor.get(key) ?? offer.priceMinor;
    return {
      ...offer,
      faresOnItinerary,
      isLowestFareOnItinerary: offer.priceMinor === lowestPriceMinor,
      lowestFareOnItineraryMinor: lowestPriceMinor,
    };
  });
}

export function formatFlightResultsCount(
  offers: OfferCard[],
  inventoryTotal?: number,
): string {
  const visible = offers.length;
  const total = inventoryTotal ?? visible;
  const uniqueItineraries = new Set(
    offers.map((o) => o.itineraryKey).filter(Boolean),
  ).size;

  const totalSuffix = total !== visible ? ` of ${total}` : "";

  if (uniqueItineraries > 0 && uniqueItineraries < visible) {
    const itinWord = uniqueItineraries === 1 ? "itinerary" : "itineraries";
    const fareWord = visible === 1 ? "fare" : "fares";
    return `${uniqueItineraries} ${itinWord} · ${visible}${totalSuffix} ${fareWord}`;
  }

  const word = visible === 1 ? "fare" : "fares";
  return `${visible}${totalSuffix} ${word}`;
}

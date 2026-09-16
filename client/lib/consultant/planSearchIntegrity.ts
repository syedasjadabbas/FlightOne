/**
 * Ensure live offers match the active merged travel plan.
 * Stale DXB results must never be returned after an IST/China correction.
 */
import { isFlight, type Offer } from "@/lib/inventory/types";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";
import type { ScoredOffer } from "@/lib/recommendation/recommendation";

function flightRouteCodes(offer: Offer): {
  origin?: string;
  destination?: string;
  date?: string;
} {
  if (!isFlight(offer)) return {};
  return {
    origin: (offer.originCode || "").toUpperCase(),
    destination: (offer.destinationCode || "").toUpperCase(),
    date: offer.departureDate || undefined,
  };
}

/**
 * Drop scored flight offers that do not match the active search origin/destination
 * (and departure date when both sides have a date).
 */
export function filterScoredOffersForActiveQuery(
  scored: ScoredOffer[],
  query: FlightSearchQuery | null,
): ScoredOffer[] {
  if (!query?.origin || !query?.destination) return scored;
  const origin = query.origin.toUpperCase();
  const destination = query.destination.toUpperCase();
  const dep = query.departureDate || "";

  return scored.filter((s) => {
    const offer = s.priced.offer;
    if (!isFlight(offer)) return true;
    const codes = flightRouteCodes(offer);
    if (codes.origin && codes.origin !== origin) return false;
    if (codes.destination && codes.destination !== destination) return false;
    if (dep && codes.date && codes.date !== dep) return false;
    return true;
  });
}

/** Dev-only log of the final normalized Travelport / supplier request. */
export function logFlightSearchRequest(query: FlightSearchQuery | null): void {
  if (process.env.NODE_ENV === "production") return;
  if (!query) return;
  console.info("[flight-search] final normalized request", {
    origin: query.origin,
    destination: query.destination,
    departureDate: query.departureDate,
    returnDate: query.returnDate ?? null,
    passengers: query.passengers,
    cabinClass: query.cabinClass ?? null,
  });
}

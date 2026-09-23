import { airlineDisplayName, airlineIataCode } from "@/lib/consultant/airlines";
import type { ItinerarySummary } from "@/lib/consultant/types";
import { isFlight, type FlightOffer, type FlightSegment } from "@/lib/inventory/types";
import type { ScoredItinerary } from "@/lib/recommendation/itineraryRecommendation";
import { formatMoney } from "@/utils/money";

function stopCodesFromSegments(segments?: FlightSegment[]): string[] | undefined {
  if (!segments || segments.length < 2) return undefined;
  const codes: string[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const code = segments[i]?.destinationCode;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes.length > 0 ? codes : undefined;
}

function estimateArriveTime(departHHMM: string, durationMinutes: number): string | null {
  if (!departHHMM || durationMinutes <= 0) return null;
  const [hh, mm] = departHHMM.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const total = hh * 60 + mm + durationMinutes;
  const outH = Math.floor(total / 60) % 24;
  const outM = total % 60;
  return `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
}

function maxLayoverFromSegments(segments?: FlightSegment[]): number {
  if (!segments?.length) return 0;
  return Math.max(0, ...segments.map((s) => s.layoverMinutesAfter ?? 0));
}

function toLeg(offer: FlightOffer, pricedMinor?: number, currency?: string): NonNullable<ItinerarySummary["legs"]>[number] {
  const maxLayoverMinutes = maxLayoverFromSegments(offer.segments);
  const marketReference = offer.tags.includes("web-meta");
  return {
    originCode: offer.originCode,
    destinationCode: offer.destinationCode,
    airline: airlineDisplayName(offer.airline),
    airlineCode: airlineIataCode(offer.airline),
    departTimeLocal: offer.departTimeLocal,
    arriveTimeLocal:
      offer.arriveTimeLocal ?? estimateArriveTime(offer.departTimeLocal, offer.durationMinutes),
    durationMinutes: offer.durationMinutes,
    stops: offer.stops,
    stopCodes: stopCodesFromSegments(offer.segments),
    ...(maxLayoverMinutes > 0 ? { maxLayoverMinutes } : {}),
    departureDate: offer.departureDate,
    ...(offer.flightNumber ? { flightNumber: offer.flightNumber } : {}),
    ...(offer.aircraft ? { aircraft: offer.aircraft } : {}),
    cabin: offer.cabin,
    ...(offer.baggageKg != null ? { baggageKg: offer.baggageKg } : {}),
    ...(offer.refundable != null ? { refundable: offer.refundable } : {}),
    ...(pricedMinor != null ? { priceMinor: pricedMinor, currency: currency ?? offer.netFare.currency } : {}),
    ...(offer.segments?.length ? { segments: offer.segments } : {}),
    ...(marketReference ? { marketReference: true as const } : {}),
    // Carried through so a multi-city trip can be quoted leg-by-leg like a
    // single-leg offer. Without it "View deal" on a trip card had no supplier
    // reference and could only fall back to sending a chat message.
    ...(offer.id ? { offerId: offer.id } : {}),
    ...(offer.supplierOfferSnapshotId
      ? { supplierOfferSnapshotId: offer.supplierOfferSnapshotId }
      : {}),
  };
}

export function toItinerarySummaries(
  scored: ScoredItinerary[],
  locale: string,
): ItinerarySummary[] {
  return scored.map((s) => {
    const flightOffers = s.itinerary.offers
      .map((p) => (isFlight(p.offer) ? p.offer : null))
      .filter((f): f is FlightOffer => f != null);

    const hops = flightOffers.map((f) => `${f.originCode}→${f.destinationCode}`);
    const legs = s.itinerary.offers
      .map((p) => (isFlight(p.offer) ? toLeg(p.offer, p.customerPrice.amount, p.customerPrice.currency) : null))
      .filter((l): l is NonNullable<ItinerarySummary["legs"]>[number] => l != null);
    const hasMarketReferenceLeg = legs.some((leg) => leg.marketReference);

    return {
      id: s.itinerary.id,
      angle: s.angle,
      score: s.score,
      totalPrice: formatMoney(s.itinerary.totalCustomerPrice, locale),
      totalPriceMinor: s.itinerary.totalCustomerPrice.amount,
      currency: s.itinerary.currency,
      reasons: s.reasons.slice(0, 4),
      hops: hops.length > 0 ? hops : ["Multi-leg journey"],
      constraintsSatisfied: s.itinerary.constraints.satisfied,
      construction: s.itinerary.ticketing.construction,
      ...(hasMarketReferenceLeg ? { hasMarketReferenceLeg: true as const } : {}),
      ...(legs.length > 0 ? { legs } : {}),
    };
  });
}

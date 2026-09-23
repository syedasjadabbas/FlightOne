/**
 * Adapts a multi-city `ItinerarySummary` into the `OfferCard` the checkout
 * flow already understands, so a trip books through exactly the same path as a
 * single-leg offer (quote → /checkout/:id) instead of a separate code path.
 *
 * The booking engine binds one booking to one supplier snapshot, so the quote
 * is anchored to the FIRST leg. The remaining legs travel in `tripLegs` so
 * checkout can show the whole journey rather than pretending the trip is one
 * sector.
 */
import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";

export type TripLegRef = {
  originCode: string;
  destinationCode: string;
  departureDate?: string;
  airlineCode: string;
  flightNumber?: string;
  priceMinor?: number;
  currency?: string;
  supplierOfferSnapshotId?: string;
};

export function offerCardFromItinerary(itinerary: ItinerarySummary): OfferCard | null {
  const legs = itinerary.legs ?? [];
  const first = legs[0];
  // Without a supplier snapshot on the first leg there is nothing to quote —
  // synthetic (hub-stitched) and web-meta trips land here.
  if (!first?.supplierOfferSnapshotId) return null;

  const tripLegs: TripLegRef[] = legs.map((l) => ({
    originCode: l.originCode,
    destinationCode: l.destinationCode,
    departureDate: l.departureDate,
    airlineCode: l.airlineCode,
    flightNumber: l.flightNumber,
    priceMinor: l.priceMinor,
    currency: l.currency ?? itinerary.currency,
    supplierOfferSnapshotId: l.supplierOfferSnapshotId,
  }));

  return {
    id: first.offerId ?? itinerary.id,
    type: "flight",
    angle: itinerary.angle as OfferCard["angle"],
    title: itinerary.hops.join(" → "),
    subtitle: `${legs.length} legs · ${itinerary.construction === "multiple_tickets" ? "separate tickets" : "single ticket"}`,
    score: itinerary.score,
    price: itinerary.totalPrice,
    // The customer pays the trip total; the snapshot only anchors the quote.
    priceMinor: itinerary.totalPriceMinor,
    currency: itinerary.currency,
    supplierOfferSnapshotId: first.supplierOfferSnapshotId,
    marketPrice: null,
    savingsPct: null,
    reasons: itinerary.reasons,
    badges: [],
    flight: {
      airline: first.airline,
      airlineCode: first.airlineCode,
      originCode: first.originCode,
      destinationCode: legs[legs.length - 1]?.destinationCode ?? first.destinationCode,
      originCity: first.originCode,
      destinationCity: legs[legs.length - 1]?.destinationCode ?? first.destinationCode,
      departTimeLocal: first.departTimeLocal,
      arriveTimeLocal: first.arriveTimeLocal,
      departureDate: first.departureDate,
      durationMinutes: legs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      stops: first.stops,
      cabin: first.cabin ?? "economy",
      ...(first.baggageKg != null ? { baggageKg: first.baggageKg } : {}),
      ...(first.refundable != null ? { refundable: first.refundable } : {}),
      ...(first.flightNumber ? { flightNumber: first.flightNumber } : {}),
      ...(first.segments?.length ? { segments: first.segments } : {}),
    },
    metadata: { tripLegs, tripId: itinerary.id },
  };
}

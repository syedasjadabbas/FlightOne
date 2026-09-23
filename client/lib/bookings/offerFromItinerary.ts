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
import type { FlightSegment } from "@/lib/inventory/types";

export type TripLegRef = {
  originCode: string;
  destinationCode: string;
  departureDate?: string;
  airline?: string;
  airlineCode: string;
  airlineName?: string;
  flightNumber?: string;
  departTimeLocal?: string;
  arriveTimeLocal?: string | null;
  durationMinutes?: number;
  cabin?: string;
  priceMinor?: number;
  currency?: string;
  supplierOfferSnapshotId?: string;
  stops?: number;
  // Every leg's sectors, so the journey card and ticket are not limited to
  // the first leg (the only one whose sectors live on the booking snapshot).
  segments?: FlightSegment[];
};

export function offerCardFromItinerary(itinerary: ItinerarySummary): OfferCard | null {
  const legs = itinerary.legs ?? [];
  const first = legs[0];
  if (!first) return null;

  const fallbackId = first.offerId?.trim() || itinerary.id?.trim();
  const snapshotId =
    first.supplierOfferSnapshotId?.trim() ||
    (fallbackId
      ? `snap_demo_${first.originCode.toLowerCase()}-${first.destinationCode.toLowerCase()}_${fallbackId}`
      : undefined);

  if (!snapshotId) return null;

  const tripLegs: TripLegRef[] = legs.map((l) => ({
    originCode: l.originCode,
    destinationCode: l.destinationCode,
    departureDate: l.departureDate,
    airline: l.airline,
    airlineCode: l.airlineCode,
    airlineName: l.airline,
    flightNumber: l.flightNumber,
    departTimeLocal: l.departTimeLocal,
    arriveTimeLocal: l.arriveTimeLocal,
    durationMinutes: l.durationMinutes,
    cabin: l.cabin,
    priceMinor: l.priceMinor,
    currency: l.currency ?? itinerary.currency,
    supplierOfferSnapshotId: l.supplierOfferSnapshotId || snapshotId,
    stops: l.stops,
    ...(l.segments?.length ? { segments: l.segments } : {}),
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
    supplierOfferSnapshotId: snapshotId,
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
    metadata: {
      tripLegs,
      legs: tripLegs,
      tripId: itinerary.id,
      construction: itinerary.construction,
      hops: itinerary.hops,
    },
  };
}

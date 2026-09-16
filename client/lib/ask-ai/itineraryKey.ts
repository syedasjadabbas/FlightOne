import type { OfferCard, OfferCardFlight } from "@/lib/consultant/types";
import type { FlightOffer, FlightSegment } from "@/lib/inventory/types";

function normCode(code: string | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

function normFlightNumber(fn: string | undefined, carrier: string | undefined): string {
  const raw = (fn || carrier || "").replace(/\s+/g, "").toUpperCase();
  return raw || "UNK";
}

/** One flown sector — excludes price, cabin, baggage. */
export function segmentItineraryToken(seg: FlightSegment): string {
  const carrier = normCode(seg.carrier) || normFlightNumber(seg.flightNumber, seg.carrier).slice(0, 2);
  return [
    normCode(seg.originCode),
    normCode(seg.destinationCode),
    seg.departureDate ?? "",
    seg.departTimeLocal ?? "",
    seg.arrivalDate ?? "",
    seg.arriveTimeLocal ?? "",
    carrier,
    normFlightNumber(seg.flightNumber, seg.carrier),
  ].join("|");
}

function legChainKey(segments: FlightSegment[] | undefined): string {
  if (!segments?.length) return "";
  return segments.map(segmentItineraryToken).join(">");
}

function constructionPrefix(tags: string[] | undefined): string {
  if (tags?.includes("hub-stitched")) return "hub";
  return "direct";
}

/** Stable itinerary identity from normalized flight inventory. */
export function buildItineraryKeyFromFlightOffer(offer: FlightOffer): string {
  const outbound =
    legChainKey(offer.segments) ||
    [
      normCode(offer.originCode),
      normCode(offer.destinationCode),
      offer.departureDate ?? "",
      offer.departTimeLocal ?? "",
      "",
      offer.arriveTimeLocal ?? "",
      normCode(offer.airline)?.slice(0, 2),
      normFlightNumber(offer.flightNumber, offer.airline),
    ].join("|");

  const inbound = legChainKey(offer.returnSegments);
  const parts = [
    normCode(offer.originCode),
    normCode(offer.destinationCode),
    offer.departureDate ?? "",
    offer.returnDate ?? "",
    constructionPrefix(offer.tags),
    `OB:${outbound}`,
  ];
  if (inbound) parts.push(`RT:${inbound}`);
  return parts.join("::");
}

/** Stable itinerary identity from a display OfferCard flight block. */
export function buildItineraryKeyFromOfferCard(
  flight: OfferCardFlight,
  tags?: string[],
): string {
  const outbound =
    legChainKey(flight.segments) ||
    [
      normCode(flight.originCode),
      normCode(flight.destinationCode),
      flight.departureDate ?? "",
      flight.departTimeLocal ?? "",
      "",
      flight.arriveTimeLocal ?? "",
      normCode(flight.airlineCode),
      normFlightNumber(flight.flightNumber, flight.airlineCode),
    ].join("|");

  const inbound = legChainKey(flight.returnSegments);
  const parts = [
    normCode(flight.originCode),
    normCode(flight.destinationCode),
    flight.departureDate ?? "",
    flight.returnDate ?? "",
    constructionPrefix(tags),
    `OB:${outbound}`,
  ];
  if (inbound) parts.push(`RT:${inbound}`);
  return parts.join("::");
}

/** Marketing/operating carrier IATA codes from segment sequence. */
export function segmentCarrierCodes(flight: OfferCardFlight): string[] {
  const codes = new Set<string>();
  for (const leg of [flight.segments, flight.returnSegments]) {
    for (const seg of leg ?? []) {
      const c = (seg.carrier || "").trim().toUpperCase();
      if (c) codes.add(c);
    }
  }
  if (codes.size === 0 && flight.airlineCode) {
    codes.add(flight.airlineCode.toUpperCase());
  }
  return [...codes];
}

export function countUniqueItineraries(offers: OfferCard[]): number {
  const keys = new Set<string>();
  for (const o of offers) {
    if (o.itineraryKey) keys.add(o.itineraryKey);
  }
  return keys.size;
}

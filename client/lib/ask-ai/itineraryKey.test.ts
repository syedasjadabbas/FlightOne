import { describe, expect, it } from "vitest";
import type { FlightOffer, FlightSegment } from "@/lib/inventory/types";
import { enrichItineraryFares } from "./enrichItineraryFares";
import {
  buildItineraryKeyFromFlightOffer,
  segmentItineraryToken,
} from "./itineraryKey";
import type { OfferCard } from "@/lib/consultant/types";

function seg(partial: Partial<FlightSegment> & Pick<FlightSegment, "originCode" | "destinationCode">): FlightSegment {
  return {
    carrier: "EY",
    flightNumber: "EY289",
    originCode: partial.originCode,
    destinationCode: partial.destinationCode,
    departureDate: partial.departureDate ?? "2026-09-10",
    departTimeLocal: partial.departTimeLocal ?? "19:45",
    arrivalDate: partial.arrivalDate ?? "2026-09-10",
    arriveTimeLocal: partial.arriveTimeLocal ?? "22:05",
    durationMinutes: partial.durationMinutes ?? 200,
    ...partial,
  };
}

function baseFlight(partial: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id: partial.id ?? "test-1",
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: "Dubai",
    destinationCode: "DXB",
    airline: "EY",
    cabin: "economy",
    stops: 1,
    durationMinutes: 505,
    departTimeLocal: "19:45",
    arriveTimeLocal: "03:10",
    departureDate: "2026-09-10",
    flightNumber: "EY289",
    airlineScore: 80,
    supplierReliability: 90,
    netFare: { amount: 10_000_000, currency: "PKR" },
    marketPrice: { amount: 10_000_000, currency: "PKR" },
    tags: ["live", "travelport"],
    segments: [
      seg({ originCode: "LHE", destinationCode: "AUH", flightNumber: "EY289" }),
      seg({
        originCode: "AUH",
        destinationCode: "DXB",
        flightNumber: "EY5412",
        departTimeLocal: "01:10",
        arriveTimeLocal: "03:10",
        departureDate: "2026-09-11",
        arrivalDate: "2026-09-11",
      }),
    ],
    ...partial,
  };
}

function card(id: string, priceMinor: number, baggageKg?: number): OfferCard {
  const f = baseFlight({ id });
  return {
    id,
    type: "flight",
    angle: "recommended",
    title: "LHE → DXB",
    subtitle: "",
    price: `PKR ${priceMinor}`,
    priceMinor,
    currency: "PKR",
    marketPrice: null,
    savingsPct: null,
    reasons: [],
    badges: [],
    itineraryKey: buildItineraryKeyFromFlightOffer(f),
    flight: {
      airline: "Etihad",
      airlineCode: "EY",
      originCode: "LHE",
      destinationCode: "DXB",
      originCity: "Lahore",
      destinationCity: "Dubai",
      originAirportName: "LHE",
      destinationAirportName: "DXB",
      nearbyAirport: false,
      departTimeLocal: "19:45",
      arriveTimeLocal: "03:10",
      departureDate: "2026-09-10",
      durationMinutes: 505,
      stops: 1,
      cabin: "economy",
      flightNumber: "EY289",
      segments: f.segments,
      ...(baggageKg != null ? { baggageKg } : {}),
    },
  };
}

describe("segmentItineraryToken", () => {
  it("ignores price and baggage", () => {
    const a = segmentItineraryToken(seg({ originCode: "LHE", destinationCode: "AUH" }));
    const b = segmentItineraryToken(seg({ originCode: "LHE", destinationCode: "AUH" }));
    expect(a).toBe(b);
  });
});

describe("buildItineraryKeyFromFlightOffer", () => {
  it("same itinerary + different price → same key", () => {
    const a = buildItineraryKeyFromFlightOffer(baseFlight({ id: "a", netFare: { amount: 100, currency: "PKR" } }));
    const b = buildItineraryKeyFromFlightOffer(baseFlight({ id: "b", netFare: { amount: 200, currency: "PKR" } }));
    expect(a).toBe(b);
  });

  it("same itinerary + different baggage → same key", () => {
    const a = buildItineraryKeyFromFlightOffer(baseFlight({ baggageKg: 23 }));
    const b = buildItineraryKeyFromFlightOffer(baseFlight({ baggageKg: undefined }));
    expect(a).toBe(b);
  });

  it("same route + different flight number → different key", () => {
    const a = buildItineraryKeyFromFlightOffer(baseFlight());
    const b = buildItineraryKeyFromFlightOffer(
      baseFlight({
        segments: [
          seg({ originCode: "LHE", destinationCode: "AUH", flightNumber: "EK601" }),
          seg({
            originCode: "AUH",
            destinationCode: "DXB",
            flightNumber: "EK5412",
            departTimeLocal: "01:10",
            arriveTimeLocal: "03:10",
            departureDate: "2026-09-11",
            arrivalDate: "2026-09-11",
            carrier: "EK",
          }),
        ],
      }),
    );
    expect(a).not.toBe(b);
  });

  it("same flight + different departure time → different key", () => {
    const a = buildItineraryKeyFromFlightOffer(baseFlight());
    const b = buildItineraryKeyFromFlightOffer(
      baseFlight({
        departTimeLocal: "08:00",
        segments: [
          seg({ originCode: "LHE", destinationCode: "AUH", departTimeLocal: "08:00" }),
          seg({
            originCode: "AUH",
            destinationCode: "DXB",
            flightNumber: "EY5412",
            departTimeLocal: "01:10",
            arriveTimeLocal: "03:10",
            departureDate: "2026-09-11",
            arrivalDate: "2026-09-11",
          }),
        ],
      }),
    );
    expect(a).not.toBe(b);
  });

  it("different connection airport → different key", () => {
    const a = buildItineraryKeyFromFlightOffer(baseFlight());
    const b = buildItineraryKeyFromFlightOffer(
      baseFlight({
        segments: [
          seg({ originCode: "LHE", destinationCode: "DOH", flightNumber: "QR601" }),
          seg({
            originCode: "DOH",
            destinationCode: "DXB",
            flightNumber: "QR101",
            carrier: "QR",
            departTimeLocal: "01:10",
            arriveTimeLocal: "03:10",
            departureDate: "2026-09-11",
            arrivalDate: "2026-09-11",
          }),
        ],
      }),
    );
    expect(a).not.toBe(b);
  });

  it("round-trip different return → different key", () => {
    const out = baseFlight();
    const a = buildItineraryKeyFromFlightOffer({
      ...out,
      returnDate: "2026-09-15",
      returnSegments: [
        seg({
          originCode: "DXB",
          destinationCode: "LHE",
          flightNumber: "EY5413",
          departureDate: "2026-09-15",
          arrivalDate: "2026-09-15",
        }),
      ],
    });
    const b = buildItineraryKeyFromFlightOffer({
      ...out,
      returnDate: "2026-09-16",
      returnSegments: [
        seg({
          originCode: "DXB",
          destinationCode: "LHE",
          flightNumber: "EY5415",
          departureDate: "2026-09-16",
          arrivalDate: "2026-09-16",
        }),
      ],
    });
    expect(a).not.toBe(b);
  });

  it("hub-stitched vs direct → different key", () => {
    const direct = buildItineraryKeyFromFlightOffer(baseFlight({ tags: ["live", "travelport"] }));
    const hub = buildItineraryKeyFromFlightOffer(
      baseFlight({ tags: ["live", "travelport", "hub-stitched"] }),
    );
    expect(direct).not.toBe(hub);
  });
});

describe("enrichItineraryFares", () => {
  it("preserves both fares for same itinerary", () => {
    const offers = enrichItineraryFares([
      card("fare-a", 109_152_60),
      card("fare-b", 113_098_40),
    ]);
    expect(offers).toHaveLength(2);
    expect(offers[0]?.itineraryKey).toBe(offers[1]?.itineraryKey);
    expect(offers[0]?.faresOnItinerary).toBe(2);
    expect(offers[1]?.faresOnItinerary).toBe(2);
    expect(offers[0]?.isLowestFareOnItinerary).toBe(true);
    expect(offers[1]?.isLowestFareOnItinerary).toBe(false);
  });

  it("preserves different itineraries", () => {
    const cheap = card("a", 100);
    const different = card("b", 200);
    different.flight!.segments = [
      seg({ originCode: "LHE", destinationCode: "DOH", flightNumber: "QR601", carrier: "QR" }),
      seg({
        originCode: "DOH",
        destinationCode: "DXB",
        flightNumber: "QR101",
        carrier: "QR",
        departTimeLocal: "01:10",
        arriveTimeLocal: "03:10",
        departureDate: "2026-09-11",
        arrivalDate: "2026-09-11",
      }),
    ];
    different.itineraryKey = buildItineraryKeyFromFlightOffer(
      baseFlight({
        id: "b",
        segments: different.flight!.segments,
      }),
    );
    const offers = enrichItineraryFares([cheap, different]);
    expect(offers[0]?.itineraryKey).not.toBe(offers[1]?.itineraryKey);
    expect(offers[0]?.faresOnItinerary).toBe(1);
    expect(offers[1]?.faresOnItinerary).toBe(1);
  });
});

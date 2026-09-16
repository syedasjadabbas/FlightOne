import { describe, expect, it } from "vitest";
import type { OfferCard } from "@/lib/consultant/types";
import {
  BAGGAGE_UNAVAILABLE,
  describeFareDifferences,
  formatBaggageAllowance,
  formatFareRulesSummary,
  hasCheckedBaggageIncluded,
} from "./fareDisplay";
import { buildItineraryKeyFromFlightOffer } from "@/lib/ask-ai/itineraryKey";
import type { FlightOffer } from "./types";

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
    segments: [],
    ...partial,
  };
}

function card(id: string, priceMinor: number, extra: Partial<OfferCard["flight"]> = {}): OfferCard {
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
      ...extra,
    },
  };
}

describe("formatBaggageAllowance", () => {
  it("shows unavailable when no data", () => {
    expect(formatBaggageAllowance(undefined, undefined)).toBe(BAGGAGE_UNAVAILABLE);
  });

  it("shows carry-on and checked from Travelport allowance", () => {
    expect(
      formatBaggageAllowance({
        carryOn: { included: true, pieces: 1 },
        checked: { included: false, weightKg: 0 },
      }),
    ).toContain("Carry-on");
    expect(
      formatBaggageAllowance({
        carryOn: { included: true, pieces: 1 },
        checked: { included: false, weightKg: 0 },
      }),
    ).toContain("not included");
  });
});

describe("formatFareRulesSummary", () => {
  it("shows unavailable when no rules", () => {
    expect(formatFareRulesSummary(undefined, undefined)).toMatch(/unavailable/i);
  });

  it("shows Travelport penalty lines", () => {
    expect(
      formatFareRulesSummary({ cancellation: "Non-refundable", changes: "Changes not permitted" }),
    ).toContain("Non-refundable");
  });

  it("strips leaked [object Object] from rule strings", () => {
    expect(
      formatFareRulesSummary({ changes: "Fee may apply ([object Object])" }),
    ).toBe("Changes: Fee may apply");
  });

  it("does not stringify raw objects as [object Object]", () => {
    expect(
      formatFareRulesSummary({
        changes: { text: "Fee may apply" } as unknown as string,
      }),
    ).toContain("Fee may apply");
    expect(
      formatFareRulesSummary({
        changes: { fee: 100 } as unknown as string,
      }),
    ).toMatch(/unavailable/i);
  });
});

describe("hasCheckedBaggageIncluded", () => {
  it("returns false when checked not included", () => {
    expect(hasCheckedBaggageIncluded({ checked: { included: false, weightKg: 0 } })).toBe(false);
  });

  it("returns true when checked included with weight", () => {
    expect(hasCheckedBaggageIncluded({ checked: { included: true, weightKg: 23 } })).toBe(true);
  });
});

describe("fare identity and selection", () => {
  it("preserves separate fares on same itinerary", () => {
    const a = card("fare-a", 100_000);
    const b = card("fare-b", 120_000);
    expect(a.itineraryKey).toBe(b.itineraryKey);
    expect(a.id).not.toBe(b.id);
    expect(a.priceMinor).not.toBe(b.priceMinor);
  });

  it("View Deal mapping keeps exact offer id and price", () => {
    const selected = card("fare-b", 113_098_40, {
      fareBrandName: "Economy Value",
      fareRulesSummary: { cancellation: "Non-refundable" },
    });
    expect(selected.id).toBe("fare-b");
    expect(selected.priceMinor).toBe(113_098_40);
    expect(selected.flight?.fareBrandName).toBe("Economy Value");
  });

  it("describes meaningful fare differences", () => {
    const a = card("a", 100, { fareBrandName: "Economy Basic" });
    const b = card("b", 120, {
      fareBrandName: "Economy Value",
      baggageAllowance: { checked: { included: true, weightKg: 23 } },
    });
    const diffs = describeFareDifferences(a, b);
    expect(diffs.some((d) => d.startsWith("Price:"))).toBe(true);
    expect(diffs.some((d) => d.startsWith("Fare:"))).toBe(true);
  });
});

describe("overnight arrival date", () => {
  it("segment preserves distinct arrival date", () => {
    const c = card("x", 100);
    const seg = c.flight!.segments?.[0];
    expect(seg).toBeUndefined();
    c.flight!.segments = [
      {
        carrier: "EY",
        flightNumber: "EY289",
        originCode: "LHE",
        destinationCode: "AUH",
        departureDate: "2026-09-10",
        departTimeLocal: "19:45",
        arrivalDate: "2026-09-10",
        arriveTimeLocal: "22:05",
        durationMinutes: 200,
      },
      {
        carrier: "EY",
        flightNumber: "EY5412",
        originCode: "AUH",
        destinationCode: "DXB",
        departureDate: "2026-09-11",
        departTimeLocal: "01:10",
        arrivalDate: "2026-09-11",
        arriveTimeLocal: "03:10",
        durationMinutes: 120,
      },
    ];
    expect(c.flight!.segments[1]?.arrivalDate).toBe("2026-09-11");
  });
});

describe("hub-stitched warning flag", () => {
  it("hubStitched is preserved on offer card", () => {
    const stitched = card("hub", 100);
    stitched.hubStitched = true;
    expect(stitched.hubStitched).toBe(true);
  });
});

describe("round-trip fare mapping", () => {
  it("roundTrip flag and return segments preserved", () => {
    const rt = card("rt", 200_000, {
      returnSegments: [
        {
          carrier: "EY",
          flightNumber: "EY5413",
          originCode: "DXB",
          destinationCode: "LHE",
          departureDate: "2026-09-15",
          departTimeLocal: "10:00",
          arrivalDate: "2026-09-15",
          arriveTimeLocal: "18:00",
          durationMinutes: 480,
        },
      ],
      returnDate: "2026-09-15",
    });
    expect(rt.flight?.returnSegments?.length).toBe(1);
    expect(rt.flight?.returnDate).toBe("2026-09-15");
  });
});

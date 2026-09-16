import { describe, expect, it } from "vitest";
import type { OfferCard } from "@/lib/consultant/types";
import type { FilterPill } from "./types";
import { applyFilterPills, filterHelpers, togglePill } from "./applyFilters";
import { sortOffers } from "./sortOffers";

function flightOffer(
  id: string,
  overrides: Partial<OfferCard> & { flight?: Partial<NonNullable<OfferCard["flight"]>> } = {},
): OfferCard {
  const { flight: flightOverrides, ...rest } = overrides;
  return {
    id,
    type: "flight",
    angle: "best_value",
    title: "LHE → DXB",
    subtitle: "Emirates · economy · non-stop · 3h · dep 09:00",
    price: "PKR 60,000",
    priceMinor: 6000000,
    currency: "PKR",
    marketPrice: null,
    savingsPct: null,
    reasons: [],
    badges: ["Non-stop"],
    unitsLeft: 4,
    flight: {
      airline: "Emirates",
      airlineCode: "EK",
      originCode: "LHE",
      destinationCode: "DXB",
      originCity: "Lahore",
      destinationCity: "Dubai",
      departTimeLocal: "09:00",
      arriveTimeLocal: "12:00",
      durationMinutes: 180,
      stops: 0,
      cabin: "economy",
      baggageKg: 30,
      refundable: true,
      ...flightOverrides,
    },
    ...rest,
  };
}

function hotelOffer(id: string, stars: number, priceMinor: number): OfferCard {
  return {
    id,
    type: "hotel",
    angle: "top_rated",
    title: "Burj Al Arab",
    subtitle: `${stars}★ · Jumeirah · Deluxe · guest 9.2/10 · per night`,
    price: `PKR ${priceMinor / 100}`,
    priceMinor,
    currency: "PKR",
    marketPrice: null,
    savingsPct: null,
    reasons: [],
    badges: [],
    unitsLeft: 2,
  };
}

describe("applyFilterPills", () => {
  const pool = [
    flightOffer("direct-ek", { priceMinor: 7000000 }),
    flightOffer("one-stop-qr", {
      priceMinor: 5500000,
      subtitle: "Qatar Airways · economy · 1 stop · 5h · dep 14:00",
      badges: [],
      flight: {
        airline: "Qatar Airways",
        airlineCode: "QR",
        stops: 1,
        durationMinutes: 300,
        departTimeLocal: "14:00",
      },
    }),
    hotelOffer("hotel-5", 5, 40000000),
    hotelOffer("hotel-3", 3, 12000000),
  ];

  it("returns all offers when no pills are active", () => {
    const pills: FilterPill[] = [
      {
        id: "nonstop",
        label: "Nonstop",
        kind: "nonstop",
        active: false,
        source: "nl",
      },
    ];
    expect(applyFilterPills(pool, pills)).toHaveLength(4);
  });

  it("filters to nonstop flights only", () => {
    const pills: FilterPill[] = [
      {
        id: "nonstop",
        label: "Nonstop",
        kind: "nonstop",
        active: true,
        source: "nl",
      },
    ];
    const out = applyFilterPills(pool, pills);
    expect(out.map((o) => o.id)).toEqual(["direct-ek"]);
  });

  it("respects max_stops including return bound", () => {
    const roundTripOneStop = flightOffer("rt-one-stop", {
      flight: {
        stops: 0,
        returnStops: 1,
        returnDurationMinutes: 320,
      },
    });
    const pills: FilterPill[] = [
      {
        id: "max-1",
        label: "Max 1 stop",
        kind: "max_stops",
        active: true,
        source: "nl",
        value: 1,
      },
    ];
    const out = applyFilterPills([pool[0], roundTripOneStop], pills);
    expect(out.map((o) => o.id)).toEqual(["direct-ek", "rt-one-stop"]);

    const strict = applyFilterPills([pool[0], roundTripOneStop], [
      { ...pills[0], id: "max-0", value: 0 },
    ]);
    expect(strict.map((o) => o.id)).toEqual(["direct-ek"]);
  });

  it("filters by airline with OR within kind", () => {
    const pills: FilterPill[] = [
      {
        id: "air-ek",
        label: "Emirates",
        kind: "airline",
        active: true,
        source: "nl",
        value: "EK",
      },
      {
        id: "air-qr",
        label: "Qatar",
        kind: "airline",
        active: true,
        source: "nl",
        value: "QR",
      },
    ];
    const out = applyFilterPills(pool, pills);
    expect(out.map((o) => o.id)).toEqual(["direct-ek", "one-stop-qr"]);
  });

  it("filters hotels by minimum stars", () => {
    const pills: FilterPill[] = [
      {
        id: "stars-4",
        label: "4+ stars",
        kind: "stars",
        active: true,
        source: "nl",
        value: 4,
      },
    ];
    const out = applyFilterPills(pool, pills);
    expect(out.map((o) => o.id)).toEqual(["hotel-5"]);
  });

  it("filters by product type", () => {
    const pills: FilterPill[] = [
      {
        id: "type-flight",
        label: "Flights",
        kind: "type",
        active: true,
        source: "manual",
        value: "flight",
      },
    ];
    const out = applyFilterPills(pool, pills);
    expect(out.every((o) => o.type === "flight")).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("ANDs constraints across kinds", () => {
    const pills: FilterPill[] = [
      {
        id: "type-flight",
        label: "Flights",
        kind: "type",
        active: true,
        source: "manual",
        value: "flight",
      },
      {
        id: "air-ek",
        label: "Emirates",
        kind: "airline",
        active: true,
        source: "nl",
        value: "EK",
      },
    ];
    const out = applyFilterPills(pool, pills);
    expect(out.map((o) => o.id)).toEqual(["direct-ek"]);
  });
});

describe("togglePill", () => {
  it("flips active on the matching id only", () => {
    const pills: FilterPill[] = [
      {
        id: "a",
        label: "A",
        kind: "nonstop",
        active: true,
        source: "nl",
      },
      {
        id: "b",
        label: "B",
        kind: "stars",
        active: false,
        source: "manual",
        value: 4,
      },
    ];
    const next = togglePill(pills, "a");
    expect(next[0].active).toBe(false);
    expect(next[1].active).toBe(false);
  });
});

describe("sortOffers", () => {
  const offers = [
    flightOffer("fast", {
      priceMinor: 8000000,
      angle: "fastest",
      flight: { durationMinutes: 150, stops: 0 },
    }),
    flightOffer("cheap", {
      priceMinor: 5000000,
      angle: "cheapest",
      flight: { durationMinutes: 360, stops: 1, airlineCode: "PK" },
    }),
    flightOffer("best", {
      priceMinor: 6500000,
      angle: "best_value",
      flight: { durationMinutes: 240, stops: 0 },
    }),
  ];

  it("sorts by price ascending by default", () => {
    expect(sortOffers(offers, "price").map((o) => o.id)).toEqual([
      "cheap",
      "best",
      "fast",
    ]);
  });

  it("sorts by duration ascending", () => {
    expect(sortOffers(offers, "duration").map((o) => o.id)).toEqual([
      "fast",
      "best",
      "cheap",
    ]);
  });

  it("sorts by score descending by default", () => {
    expect(sortOffers(offers, "score").map((o) => o.id)).toEqual([
      "best",
      "cheap",
      "fast",
    ]);
  });

  it("sorts by angle rank", () => {
    expect(sortOffers(offers, "angle").map((o) => o.id)).toEqual([
      "best",
      "cheap",
      "fast",
    ]);
  });
});

describe("filterHelpers", () => {
  it("detects round-trip nonstop correctly", () => {
    expect(filterHelpers.isNonstopFlight(flightOffer("a"))).toBe(true);
    expect(
      filterHelpers.isNonstopFlight(
        flightOffer("b", { flight: { stops: 0, returnStops: 1 } }),
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { priceOffer, priceAll, DEFAULT_PRICING } from "./pricing";
import type { FlightOffer, HotelOffer } from "@/lib/inventory/types";

/**
 * Display-path pricing aligned with Module 05 product defaults.
 * Authoritative booking prices come from the server pricing.service — never
 * from client-supplied amounts.
 */

function flight(overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id: "f1",
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: "Dubai",
    destinationCode: "DXB",
    airline: "Emirates",
    cabin: "economy",
    stops: 0,
    durationMinutes: 210,
    departTimeLocal: "09:00",
    refundable: false,
    airlineScore: 80,
    supplierReliability: 90,
    netFare: { amount: 10000, currency: "USD" },
    marketPrice: { amount: 10000, currency: "USD" },
    tags: ["live", "travelport"],
    ...overrides,
  };
}

function hotel(overrides: Partial<HotelOffer> = {}): HotelOffer {
  return {
    id: "h1",
    type: "hotel",
    supplier: "Travelport",
    city: "Dubai",
    cityCode: "DXB",
    name: "Test Hotel",
    area: "Marina",
    stars: 4,
    roomType: "Deluxe",
    breakfastIncluded: false,
    ratingScore: 8,
    reviewCount: 100,
    distanceToCentreKm: 2,
    refundable: true,
    netFare: { amount: 10000, currency: "USD" },
    marketPrice: { amount: 10000, currency: "USD" },
    tags: ["live", "stays"],
    supplierReliability: 90,
    ...overrides,
  };
}

describe("display pricing defaults (aligned with Module 05)", () => {
  it("applies 9% flight markup", () => {
    const priced = priceOffer(flight());
    expect(priced.customerPrice.amount).toBe(Math.round(10000 * 1.09));
    expect(priced.marginMinor).toBe(priced.customerPrice.amount - 10000);
  });

  it("applies 14% hotel markup", () => {
    const priced = priceOffer(hotel());
    expect(priced.customerPrice.amount).toBe(Math.round(10000 * 1.14));
  });

  it("keeps product markups separate", () => {
    expect(DEFAULT_PRICING.markupPct.flight).toBe(9);
    expect(DEFAULT_PRICING.markupPct.hotel).toBe(14);
    const [f, h] = priceAll([flight(), hotel()]);
    expect(f.customerPrice.amount).not.toBe(h.customerPrice.amount);
  });

  it("never prices below min margin floor for AI discount room", () => {
    const priced = priceOffer(flight());
    const minFloor = Math.round(10000 * (1 + DEFAULT_PRICING.minMarginPct / 100));
    expect(priced.aiFloorPrice.amount).toBeGreaterThanOrEqual(minFloor);
  });

  it("preserves supplier fare currency", () => {
    const priced = priceOffer(
      flight({
        netFare: { amount: 5000, currency: "PKR" },
        marketPrice: { amount: 5000, currency: "PKR" },
      }),
    );
    expect(priced.customerPrice.currency).toBe("PKR");
  });

  it("uses serverSellPrice when present (no double markup)", () => {
    const priced = priceOffer(
      flight({
        serverSellPrice: { amount: 10900, currency: "USD" },
      }),
    );
    expect(priced.customerPrice.amount).toBe(10900);
    expect(priced.marginMinor).toBe(900);
    // Local 9% would also be 10900 for 10000 net — use a divergent server sell to prove authority.
    const divergent = priceOffer(
      flight({
        serverSellPrice: { amount: 11250, currency: "USD" },
      }),
    );
    expect(divergent.customerPrice.amount).toBe(11250);
    expect(divergent.customerPrice.amount).not.toBe(Math.round(10000 * 1.09));
  });
});

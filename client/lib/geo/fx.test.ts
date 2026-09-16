import { describe, expect, it } from "vitest";
import { convertMoney, convertOfferToCurrency } from "./fx";
import type { FlightOffer } from "@/lib/inventory/types";

describe("convertMoney", () => {
  it("leaves same-currency amounts unchanged", () => {
    expect(convertMoney({ amount: 10050, currency: "PKR" }, "PKR")).toEqual({
      amount: 10050,
      currency: "PKR",
    });
  });

  it("converts USD minor units into PKR", () => {
    const out = convertMoney({ amount: 10000, currency: "USD" }, "PKR");
    expect(out.currency).toBe("PKR");
    // $100 * 278 = 27,800 PKR → 2_780_000 minor
    expect(out.amount).toBe(2_780_000);
  });

  it("round-trips reasonably PKR → USD → PKR", () => {
    // PKR 2,780.00 → $10.00 → PKR 2,780.00
    const usd = convertMoney({ amount: 278_000, currency: "PKR" }, "USD");
    const back = convertMoney(usd, "PKR");
    expect(usd.amount).toBe(1_000);
    expect(back.amount).toBe(278_000);
  });
});

describe("convertOfferToCurrency", () => {
  it("normalizes net and market currencies", () => {
    const offer: FlightOffer = {
      id: "t1",
      type: "flight",
      supplier: "Travelport",
      origin: "Karachi",
      originCode: "KHI",
      destination: "Dubai",
      destinationCode: "DXB",
      airline: "PK",
      cabin: "economy",
      stops: 0,
      durationMinutes: 180,
      departTimeLocal: "10:00",
      baggageKg: 20,
      airlineScore: 80,
      refundable: false,
      supplierReliability: 90,
      unitsLeft: 3,
      tags: ["live"],
      netFare: { amount: 20000, currency: "USD" },
      marketPrice: { amount: 22000, currency: "USD" },
    };
    const converted = convertOfferToCurrency(offer, "PKR");
    expect(converted.netFare.currency).toBe("PKR");
    expect(converted.marketPrice.currency).toBe("PKR");
    expect(converted.netFare.amount).toBe(5_560_000);
  });
});

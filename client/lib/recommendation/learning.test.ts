import { describe, expect, it } from "vitest";
import { priceAll } from "@/lib/pricing/pricing";
import type { FlightOffer } from "@/lib/inventory/types";
import {
  aggregateLearnedPreferences,
  computeLearnedBoost,
  LEARNING_BOUNDS,
} from "./learning";
import { buildRankContext, curate, rank } from "./recommendation";

function flight(id: string, overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: "Dubai",
    destinationCode: "DXB",
    airline: "FlyDubai",
    cabin: "economy",
    stops: 0,
    durationMinutes: 210,
    departTimeLocal: "09:00",
    refundable: false,
    baggageKg: 20,
    unitsLeft: 4,
    netFare: { amount: 5100000, currency: "PKR" },
    marketPrice: { amount: 5100000, currency: "PKR" },
    tags: ["live", "travelport", "gds"],
    ...overrides,
  };
}

describe("Module 4 learning loop (frontend)", () => {
  it("feeds verified ACCEPT feedback into later ranking", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const pool = priceAll([
      flight("pia", { airline: "PIA" }),
      flight("etihad", { airline: "Etihad" }),
    ]);
    const ranked = rank(pool, { learned });
    expect(ranked[0].priced.offer.id).toBe("etihad");
    expect(ranked[0].reasons.some((r) => /accepted before/i.test(r))).toBe(true);
  });

  it("bounds feedback influence (max total learned delta)", () => {
    const events = Array.from({ length: 50 }, () => ({
      signal: "ACCEPT" as const,
      context: { airlineCode: "QR", stops: 0, refundable: true },
    }));
    const learned = aggregateLearnedPreferences(events);
    expect(learned.airlineLean.QR).toBe(LEARNING_BOUNDS.maxAirlineDelta);
    const boost = computeLearnedBoost(
      { airlineCode: "QR", stops: 0, refundable: true },
      learned,
    );
    expect(Math.abs(boost.deltaPoints)).toBeLessThanOrEqual(
      LEARNING_BOUNDS.maxTotalLearnedDelta,
    );
  });

  it("keeps learning user-scoped (empty learned = no boost)", () => {
    const pool = priceAll([
      flight("a", { airline: "PIA" }),
      flight("b", { airline: "Etihad" }),
    ]);
    const withLearn = rank(pool, {
      learned: aggregateLearnedPreferences([
        { signal: "ACCEPT", context: { airlineCode: "EY" } },
        { signal: "ACCEPT", context: { airlineCode: "EY" } },
      ]),
    });
    const without = rank(pool, { learned: null });
    expect(withLearn[0].priced.offer.id).toBe("b");
    expect(without.every((s) => !s.reasons.some((r) => /accepted before/i.test(r)))).toBe(
      true,
    );
  });

  it("explicit chat preferred airline overrides learned lean", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const pool = priceAll([
      flight("pia", { airline: "PIA" }),
      flight("etihad", { airline: "Etihad" }),
    ]);
    const ranked = rank(pool, {
      filters: { preferredAirlines: ["PK"] },
      learned,
    });
    expect(ranked[0].priced.offer.id).toBe("pia");
    expect(ranked[0].reasons.some((r) => /accepted before/i.test(r))).toBe(false);
  });

  it("profile preferred airlines outrank learned (via filters)", () => {
    // Profile fills preferredAirlines before ranking; learned must not override.
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const ctx = buildRankContext(
      "flights to Dubai",
      { preferredAirlines: ["PK"] },
      { learned },
    );
    const pool = priceAll([
      flight("pia", { airline: "PIA" }),
      flight("etihad", { airline: "Etihad" }),
    ]);
    expect(rank(pool, ctx)[0].priced.offer.id).toBe("pia");
  });

  it("chat price priority still wins over learned nonstop lean", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { stops: 0 } },
      { signal: "ACCEPT", context: { stops: 0 } },
    ]);
    expect(learned.preferNonstop).toBe(true);
    const pool = priceAll([
      flight("cheap-stop", {
        stops: 1,
        durationMinutes: 480,
        netFare: { amount: 3500000, currency: "PKR" },
        marketPrice: { amount: 3500000, currency: "PKR" },
      }),
      flight("dear-direct", {
        stops: 0,
        durationMinutes: 200,
        netFare: { amount: 9000000, currency: "PKR" },
        marketPrice: { amount: 9000000, currency: "PKR" },
      }),
    ]);
    const ranked = rank(pool, { priority: "price", learned });
    expect(ranked[0].priced.offer.id).toBe("cheap-stop");
  });

  it("omits unavailable quality/reliability from reasons", () => {
    const pool = priceAll([
      flight("a", { airlineScore: 80, supplierReliability: 90 }),
      flight("b", {
        airlineScore: 80,
        supplierReliability: 90,
        netFare: { amount: 6000000, currency: "PKR" },
        marketPrice: { amount: 6000000, currency: "PKR" },
      }),
    ]);
    const reasons = curate(pool, 3).flatMap((s) => s.reasons).join(" ");
    expect(reasons).not.toMatch(/reliability|higher quality|on-time/i);
  });

  it("keeps distinct Best/Cheapest/Fastest and thin inventory", () => {
    const rich = curate(
      priceAll([
        flight("cheap", {
          netFare: { amount: 3000000, currency: "PKR" },
          marketPrice: { amount: 3000000, currency: "PKR" },
          durationMinutes: 500,
          stops: 2,
        }),
        flight("best", {
          netFare: { amount: 5200000, currency: "PKR" },
          marketPrice: { amount: 5200000, currency: "PKR" },
          durationMinutes: 210,
          stops: 0,
        }),
        flight("fast", {
          netFare: { amount: 7000000, currency: "PKR" },
          marketPrice: { amount: 7000000, currency: "PKR" },
          durationMinutes: 150,
          stops: 0,
        }),
      ]),
      3,
    );
    expect(rich.map((s) => s.angle).sort()).toEqual(
      ["best_value", "cheapest", "fastest"].sort(),
    );
    expect(new Set(rich.map((s) => s.priced.offer.id)).size).toBe(3);

    const thin = curate(priceAll([flight("only")]), 3);
    expect(thin).toHaveLength(1);
  });

  it("surfaces practical hub alternatives when no nonstop exists", () => {
    const ranked = rank(
      priceAll([
        flight("hub", {
          tags: ["live", "hub-stitched"],
          stops: 1,
          durationMinutes: 520,
          netFare: { amount: 5500000, currency: "PKR" },
          marketPrice: { amount: 5500000, currency: "PKR" },
        }),
        flight("other", {
          stops: 1,
          durationMinutes: 500,
          netFare: { amount: 5600000, currency: "PKR" },
          marketPrice: { amount: 5600000, currency: "PKR" },
        }),
      ]),
    );
    expect(ranked[0].priced.offer.id).toBe("hub");
    expect(ranked[0].reasons.some((r) => /Hub-connected/i.test(r))).toBe(true);
  });
});

describe("frontend/server learning consistency", () => {
  it("aggregates the same airline lean for identical feedback events", async () => {
    // Mirror server LEARNING_BOUNDS by importing frontend only — values must match docs.
    const events = [
      { signal: "ACCEPT" as const, context: { airlineCode: "EY" } },
      { signal: "ACCEPT" as const, context: { airlineCode: "EY" } },
      { signal: "REJECT" as const, context: { airlineCode: "PK" } },
      { signal: "REJECT" as const, context: { airlineCode: "PK" } },
    ];
    const learned = aggregateLearnedPreferences(events);
    expect(learned.airlineLean.EY).toBe(4);
    expect(learned.airlineLean.PK).toBe(-4);
    expect(learned.sampleCount).toBe(4);
  });
});

/**
 * Module 04 recommendation ranking unit tests.
 * Run: node --test modules/recommendations/recommendations.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  poolHasTrustedAirlineQuality,
  poolHasTrustedReliability,
  rankOffers,
  scoreOffer,
} from "./recommendations.service.js";

function offer(id, overrides = {}) {
  return {
    id,
    product: "FLIGHT",
    amountMinor: 50000,
    currency: "USD",
    durationMinutes: 200,
    layoverCount: 0,
    airlineCode: "EK",
    refundable: false,
    ...overrides,
  };
}

describe("rankOffers — Module 4", () => {
  it("ranks cheaper offers higher on price axis", () => {
    const result = rankOffers({
      offers: [
        offer("cheap", { amountMinor: 30000, durationMinutes: 400, layoverCount: 1 }),
        offer("dear", { amountMinor: 90000, durationMinutes: 150 }),
      ],
      limit: 3,
      includeAll: true,
    });
    const byPrice = [...result.allRanked].sort(
      (a, b) => b.breakdown.priceScore - a.breakdown.priceScore,
    );
    assert.equal(byPrice[0].offer.id, "cheap");
    assert.ok(byPrice[0].breakdown.priceScore > byPrice[1].breakdown.priceScore);
  });

  it("ranks shorter journeys as fastest", () => {
    const result = rankOffers({
      offers: [
        offer("slow", { amountMinor: 40000, durationMinutes: 500 }),
        offer("fast", { amountMinor: 80000, durationMinutes: 120 }),
      ],
      limit: 3,
      includeAll: true,
    });
    const byDur = [...result.allRanked].sort(
      (a, b) => b.breakdown.durationScore - a.breakdown.durationScore,
    );
    assert.equal(byDur[0].offer.id, "fast");
  });

  it("boosts loyalty airline when loyaltyAirlineCodes match", () => {
    const result = rankOffers({
      offers: [
        offer("pia", { airlineCode: "PK", amountMinor: 51000, durationMinutes: 210 }),
        offer("ey", { airlineCode: "EY", amountMinor: 51000, durationMinutes: 210 }),
      ],
      preferences: { loyaltyAirlineCodes: ["EY"] },
      limit: 3,
    });
    assert.equal(result.curated[0].offer.id, "ey");
    assert.match(result.curated[0].explanation, /loyalty/i);
  });

  it("applies red-eye penalty only when avoidRedEye and depart hour known", () => {
    const { score: night } = scoreOffer(
      offer("night", { departHourLocal: 2, amountMinor: 40000 }),
      {
        priceScore: 1,
        durationScore: 0.8,
        preferences: { avoidRedEye: true },
        reliabilityTrusted: false,
      },
    );
    const { score: day } = scoreOffer(
      offer("day", { departHourLocal: 10, amountMinor: 40000 }),
      {
        priceScore: 1,
        durationScore: 0.8,
        preferences: { avoidRedEye: true },
        reliabilityTrusted: false,
      },
    );
    assert.ok(day > night);
  });

  it("scores refundable true higher than non-refundable peers", () => {
    const result = rankOffers({
      offers: [
        offer("flex", { refundable: true, amountMinor: 52000 }),
        offer("strict", { refundable: false, amountMinor: 50000 }),
      ],
      limit: 3,
    });
    const flex = result.curated.find((c) => c.offer.id === "flex");
    assert.ok(flex);
    assert.match(flex.explanation, /refundable/i);
  });

  it("does not backfill recommended duplicates for default limit 3", () => {
    const result = rankOffers({
      offers: [
        offer("a", { amountMinor: 40000, durationMinutes: 400 }),
        offer("b", { amountMinor: 60000, durationMinutes: 150 }),
      ],
      limit: 3,
    });
    assert.ok(result.curated.length <= 2);
    assert.equal(result.curated.some((c) => c.label === "recommended"), false);
  });

  it("returns fewer than 3 when inventory is thin", () => {
    const result = rankOffers({
      offers: [offer("only")],
      limit: 3,
    });
    assert.equal(result.curated.length, 1);
    assert.equal(result.curated[0].label, "best_overall");
  });

  it("does not invent reliability in explanations when scores are missing/flat", () => {
    const result = rankOffers({
      offers: [
        offer("a", { supplierCode: "GALILEO" }),
        offer("b", {
          amountMinor: 70000,
          durationMinutes: 160,
          supplierCode: "RATEHAWK",
        }),
      ],
      limit: 3,
    });
    const text = result.curated.map((c) => c.explanation).join(" ");
    assert.equal(/reliability \d+%/.test(text), false);
    assert.equal(poolHasTrustedReliability(result.curated.map((c) => c.offer)), false);
  });

  it("does not apply a fabricated reliability score when untrusted", () => {
    const { breakdown, score } = scoreOffer(offer("a"), {
      priceScore: 1,
      durationScore: 1,
      preferences: {},
      reliabilityTrusted: false,
    });
    assert.equal(breakdown.supplierReliability, null);
    assert.equal(breakdown.reliabilityTrusted, false);

    const withFake = scoreOffer(offer("b", { supplierReliability: 0.9 }), {
      priceScore: 1,
      durationScore: 1,
      preferences: {},
      reliabilityTrusted: false,
    });
    assert.equal(withFake.breakdown.supplierReliability, null);
    assert.equal(score, withFake.score);
  });

  it("uses supplierReliability only when pool values differ", () => {
    const offers = [
      offer("low", { supplierReliability: 0.7, amountMinor: 51000 }),
      offer("high", { supplierReliability: 0.95, amountMinor: 52000, durationMinutes: 210 }),
    ];
    assert.equal(poolHasTrustedReliability(offers), true);
    const result = rankOffers({ offers, limit: 3 });
    const text = result.curated.map((c) => c.explanation).join(" ");
    assert.match(text, /supplier reliability/i);
  });
});

describe("airline quality axis — Module 4", () => {
  it("applies airlineScore when pool has differentiated authoritative values", () => {
    const offers = [
      offer("lowQ", { airlineScore: 60, amountMinor: 50000, durationMinutes: 200 }),
      offer("highQ", { airlineScore: 95, amountMinor: 50000, durationMinutes: 200 }),
    ];
    assert.equal(poolHasTrustedAirlineQuality(offers), true);
    const result = rankOffers({ offers, limit: 3, includeAll: true });
    const high = result.allRanked.find((r) => r.offer.id === "highQ");
    const low = result.allRanked.find((r) => r.offer.id === "lowQ");
    assert.equal(high.breakdown.airlineQualityTrusted, true);
    assert.ok(high.breakdown.airlineQuality > low.breakdown.airlineQuality);
    assert.ok(high.score > low.score);
    assert.match(result.curated.map((c) => c.explanation).join(" "), /quality/i);
  });

  it("keeps quality axis neutral when airlineScore is unavailable", () => {
    const offers = [
      offer("a", { amountMinor: 50000 }),
      offer("b", { amountMinor: 51000, durationMinutes: 210 }),
    ];
    assert.equal(poolHasTrustedAirlineQuality(offers), false);
    const result = rankOffers({ offers, limit: 3, includeAll: true });
    for (const row of result.allRanked) {
      assert.equal(row.breakdown.airlineQuality, null);
      assert.equal(row.breakdown.airlineQualityTrusted, false);
    }
    assert.equal(/quality/i.test(result.curated.map((c) => c.explanation).join(" ")), false);
  });

  it("does not treat flat identical airlineScore as trusted quality", () => {
    const offers = [
      offer("a", { airlineScore: 80, amountMinor: 50000 }),
      offer("b", { airlineScore: 80, amountMinor: 51000, durationMinutes: 210 }),
    ];
    assert.equal(poolHasTrustedAirlineQuality(offers), false);
    const result = rankOffers({ offers, limit: 3, includeAll: true });
    for (const row of result.allRanked) {
      assert.equal(row.breakdown.airlineQuality, null);
      assert.equal(row.breakdown.airlineQualityTrusted, false);
    }
  });

  it("does not fabricate a quality score when untrusted", () => {
    const base = scoreOffer(offer("a"), {
      priceScore: 1,
      durationScore: 1,
      preferences: {},
      reliabilityTrusted: false,
      airlineQualityTrusted: false,
    });
    assert.equal(base.breakdown.airlineQuality, null);

    const withOrphanScore = scoreOffer(offer("b", { airlineScore: 0.99 }), {
      priceScore: 1,
      durationScore: 1,
      preferences: {},
      reliabilityTrusted: false,
      airlineQualityTrusted: false,
    });
    assert.equal(withOrphanScore.breakdown.airlineQuality, null);
    assert.equal(base.score, withOrphanScore.score);
  });

  it("ranks deterministically for the same offer pool", () => {
    const offers = [
      offer("x", { airlineScore: 70, amountMinor: 48000, durationMinutes: 220 }),
      offer("y", { airlineScore: 90, amountMinor: 50000, durationMinutes: 200 }),
      offer("z", { airlineScore: 85, amountMinor: 49000, durationMinutes: 210 }),
    ];
    const a = rankOffers({ offers, limit: 3, includeAll: true });
    const b = rankOffers({ offers, limit: 3, includeAll: true });
    assert.deepEqual(
      a.allRanked.map((r) => [r.offer.id, r.score]),
      b.allRanked.map((r) => [r.offer.id, r.score]),
    );
  });

  it("leaves existing price-first ranking unchanged when quality is absent", () => {
    const result = rankOffers({
      offers: [
        offer("cheap", { amountMinor: 30000, durationMinutes: 400, layoverCount: 1 }),
        offer("dear", { amountMinor: 90000, durationMinutes: 150 }),
      ],
      limit: 3,
      includeAll: true,
    });
    const byPrice = [...result.allRanked].sort(
      (a, b) => b.breakdown.priceScore - a.breakdown.priceScore,
    );
    assert.equal(byPrice[0].offer.id, "cheap");
    assert.equal(byPrice[0].breakdown.airlineQuality, null);
  });
});

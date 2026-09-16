/**
 * Module 04 learning + ranking regression tests.
 * Run: node --test modules/recommendations/learning.unit.test.js modules/recommendations/recommendations.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateLearnedPreferences,
  computeLearnedBoost,
  LEARNING_BOUNDS,
} from "./learning.js";
import { rankOffers } from "./recommendations.service.js";

describe("learning loop — bounded feedback", () => {
  it("requires min samples before airline lean applies", () => {
    const one = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    assert.deepEqual(one.airlineLean, {});

    const two = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "ey" } },
    ]);
    assert.equal(two.airlineLean.EY, 4); // 2 * pointsPerNetAccept
  });

  it("caps airline lean so one interaction cannot dominate", () => {
    const events = Array.from({ length: 40 }, () => ({
      signal: "ACCEPT",
      context: { airlineCode: "QR" },
    }));
    const learned = aggregateLearnedPreferences(events);
    assert.equal(learned.airlineLean.QR, LEARNING_BOUNDS.maxAirlineDelta);
    const boost = computeLearnedBoost({ airlineCode: "QR", stops: 0 }, learned);
    assert.ok(Math.abs(boost.deltaPoints) <= LEARNING_BOUNDS.maxTotalLearnedDelta);
  });

  it("IGNORE does not train", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "IGNORE", context: { airlineCode: "EK" } },
      { signal: "IGNORE", context: { airlineCode: "EK" } },
      { signal: "IGNORE", context: { airlineCode: "EK" } },
    ]);
    assert.deepEqual(learned.airlineLean, {});
    assert.equal(learned.sampleCount, 0);
  });

  it("skips learned airline when explicit preferredAirlines set (chat/profile wins)", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const skipped = computeLearnedBoost(
      { airlineCode: "EY", stops: 0 },
      learned,
      { hasExplicitAirlinePreference: true },
    );
    assert.equal(skipped.deltaPoints, 0);
    const applied = computeLearnedBoost({ airlineCode: "EY", stops: 0 }, learned, {
      hasExplicitAirlinePreference: false,
    });
    assert.ok(applied.deltaPoints > 0);
  });
});

describe("rankOffers — learning + invariants", () => {
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

  it("feedback lean affects later ranking when no explicit airline preference", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const result = rankOffers({
      offers: [
        offer("pia", { airlineCode: "PK", amountMinor: 51000 }),
        offer("ey", { airlineCode: "EY", amountMinor: 51000 }),
      ],
      learned,
      limit: 3,
    });
    assert.equal(result.curated[0].offer.id, "ey");
    assert.match(result.curated[0].explanation, /accepted before/i);
  });

  it("explicit preferredAirlines overrides learned lean", () => {
    const learned = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const result = rankOffers({
      offers: [
        offer("pia", { airlineCode: "PK", amountMinor: 51000 }),
        offer("ey", { airlineCode: "EY", amountMinor: 51000 }),
      ],
      preferences: { preferredAirlines: ["PK"] },
      learned,
      limit: 3,
    });
    assert.equal(result.curated[0].offer.id, "pia");
    assert.equal(/accepted before/i.test(result.curated[0].explanation), false);
  });

  it("user isolation: empty learned for other user does not change order", () => {
    const userA = aggregateLearnedPreferences([
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
      { signal: "ACCEPT", context: { airlineCode: "EY" } },
    ]);
    const userB = aggregateLearnedPreferences([]); // other user
    const offers = [
      offer("pia", { airlineCode: "PK", amountMinor: 51000 }),
      offer("ey", { airlineCode: "EY", amountMinor: 51000 }),
    ];
    const a = rankOffers({ offers, learned: userA, limit: 3 });
    const b = rankOffers({ offers, learned: userB, limit: 3 });
    assert.equal(a.curated[0].offer.id, "ey");
    // Without learned lean, price/duration equal → order may be first by overall;
    // B must not gain EY preference from A's feedback.
    assert.equal(b.curated[0].breakdown.learnedBoost, 0);
  });

  it("does not invent reliability when data unavailable", () => {
    const result = rankOffers({
      offers: [offer("a"), offer("b", { amountMinor: 60000, durationMinutes: 150 })],
      limit: 3,
    });
    const text = result.curated.map((c) => c.explanation).join(" ");
    assert.equal(/reliability \d+%/.test(text), false);
  });

  it("returns distinct Best/Cheapest/Fastest and thin inventory", () => {
    const rich = rankOffers({
      offers: [
        offer("cheap", { amountMinor: 30000, durationMinutes: 500, layoverCount: 1 }),
        offer("fast", { amountMinor: 90000, durationMinutes: 120 }),
        offer("mid", { amountMinor: 50000, durationMinutes: 200 }),
      ],
      limit: 3,
    });
    const labels = rich.curated.map((c) => c.label).sort();
    assert.deepEqual(labels, ["best_overall", "cheapest", "fastest"].sort());
    assert.equal(new Set(rich.curated.map((c) => c.offer.id)).size, 3);

    const thin = rankOffers({ offers: [offer("only")], limit: 3 });
    assert.equal(thin.curated.length, 1);
  });

  it("boosts practical hub alternative when no nonstop in pool", () => {
    const result = rankOffers({
      offers: [
        offer("hub", {
          layoverCount: 1,
          durationMinutes: 520,
          amountMinor: 55000,
          tags: ["hub-stitched"],
        }),
        offer("other", {
          layoverCount: 1,
          durationMinutes: 500,
          amountMinor: 56000,
        }),
      ],
      limit: 3,
      includeAll: true,
    });
    assert.equal(result.allRanked[0].offer.id, "hub");
    assert.match(result.allRanked[0].explanation, /hub-connected/i);
  });
});

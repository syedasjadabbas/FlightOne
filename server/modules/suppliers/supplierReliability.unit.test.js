/**
 * Supplier reliability honesty unit tests.
 * Run: node --test modules/suppliers/supplierReliability.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_RELIABILITY_BOOKINGS,
  attachSupplierReliability,
  fulfillmentRatesFromRows,
} from "./supplierReliability.js";

describe("fulfillmentRatesFromRows", () => {
  it("publishes reliability only when sample meets MIN_RELIABILITY_BOOKINGS", () => {
    const thin = fulfillmentRatesFromRows([
      { supplierCode: "GALILEO", status: "TICKETED", _count: { _all: 2 } },
      { supplierCode: "GALILEO", status: "CANCELLED", _count: { _all: 1 } },
    ]);
    assert.equal(thin.size, 0);

    const enough = fulfillmentRatesFromRows([
      { supplierCode: "GALILEO", status: "TICKETED", _count: { _all: 8 } },
      { supplierCode: "GALILEO", status: "CANCELLED", _count: { _all: 2 } },
    ]);
    assert.equal(enough.size, 1);
    assert.equal(enough.get("GALILEO").bookings, 10);
    assert.equal(enough.get("GALILEO").reliabilityPct, 80);
    assert.ok(enough.get("GALILEO").bookings >= MIN_RELIABILITY_BOOKINGS);
  });

  it("does not invent a rate for suppliers missing from rows", () => {
    const rates = fulfillmentRatesFromRows([
      { supplierCode: "RATEHAWK", status: "COMPLETED", _count: { _all: 6 } },
    ]);
    assert.equal(rates.has("GALILEO"), false);
    assert.equal(rates.get("RATEHAWK").reliabilityPct, 100);
  });
});

describe("attachSupplierReliability", () => {
  it("attaches real rates and strips fabricated values when unavailable", async () => {
    const rates = new Map([
      ["GALILEO", { bookings: 20, fulfillmentRate: 0.9, reliabilityPct: 90 }],
    ]);
    const out = await attachSupplierReliability(
      [
        { offerId: "a", supplierCode: "GALILEO", supplierReliability: 99 },
        { offerId: "b", supplierCode: "RATEHAWK", supplierReliability: 88 },
        { offerId: "c", supplierCode: "GALILEO" },
      ],
      rates,
    );
    assert.equal(out[0].supplierReliability, 90);
    assert.equal(out[1].supplierReliability, undefined);
    assert.equal(out[2].supplierReliability, 90);
  });

  it("is a single map attach — not an N+1 per offer", async () => {
    const rates = new Map([
      ["GALILEO", { bookings: 10, fulfillmentRate: 0.8, reliabilityPct: 80 }],
      ["RATEHAWK", { bookings: 10, fulfillmentRate: 0.7, reliabilityPct: 70 }],
    ]);
    const offers = Array.from({ length: 50 }, (_, i) => ({
      offerId: `o${i}`,
      supplierCode: i % 2 === 0 ? "GALILEO" : "RATEHAWK",
    }));
    const out = await attachSupplierReliability(offers, rates);
    assert.equal(out.length, 50);
    assert.equal(out[0].supplierReliability, 80);
    assert.equal(out[1].supplierReliability, 70);
  });
});

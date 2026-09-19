import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forecastFromWeeklySeries,
  observedPriceAssociation,
  buildSupplierInsights,
  FORECAST_MIN_PERIODS,
  ELASTICITY_MIN_OBS,
} from "./dashboard.advanced.math.js";

describe("advanced analytics math", () => {
  it("does not invent a forecast without enough weekly observations", () => {
    const out = forecastFromWeeklySeries(
      [
        { period: "2026-08-03", value: 2, observations: 2 },
        { period: "2026-08-10", value: 1, observations: 1 },
      ],
      { metric: "volume" },
    );
    assert.equal(out.available, false);
    assert.equal(out.status, "INSUFFICIENT_DATA");
    assert.equal(out.forecast, null);
    assert.ok(out.sampleCount < FORECAST_MIN_PERIODS);
  });

  it("returns an inference (not a guarantee) when enough weeks exist", () => {
    const out = forecastFromWeeklySeries(
      [
        { period: "2026-08-03", value: 2, observations: 2 },
        { period: "2026-08-10", value: 3, observations: 3 },
        { period: "2026-08-17", value: 4, observations: 4 },
        { period: "2026-08-24", value: 5, observations: 5 },
      ],
      { metric: "volume" },
    );
    assert.equal(out.available, true);
    assert.equal(out.status, "INFERENCE");
    assert.equal(out.forecast, 6);
    assert.match(out.explanation, /not a guaranteed outcome/i);
  });

  it("does not invent elasticity without enough price observations", () => {
    const out = observedPriceAssociation(
      Array.from({ length: ELASTICITY_MIN_OBS - 1 }, () => ({ priceMinor: 1000, converted: false })),
    );
    assert.equal(out.available, false);
    assert.equal(out.causal, false);
    assert.equal(out.autoPriceChange, false);
  });

  it("reports an observed association, not a causal elasticity", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => ({ priceMinor: 5000, converted: true })),
      ...Array.from({ length: 6 }, () => ({ priceMinor: 15000, converted: false })),
    ];
    const out = observedPriceAssociation(rows);
    assert.equal(out.available, true);
    assert.equal(out.kind, "OBSERVED_ASSOCIATION");
    assert.equal(out.causal, false);
    assert.equal(out.autoPriceChange, false);
    assert.equal(out.direction, "NEGATIVE");
  });

  it("withholds supplier insights below the minimum booking count", () => {
    const out = buildSupplierInsights([{ supplierCode: "GALILEO", bookings: 2, cancelRefundRate: 0 }]);
    assert.equal(out.available, false);
    assert.equal(out.autoNegotiate, false);
    assert.equal(out.insights.length, 0);
  });

  it("emits share insight from verified supplier volume only", () => {
    const out = buildSupplierInsights([
      { supplierCode: "GALILEO", bookings: 8, cancelRefundRate: 0.1, topRoute: "LHE-DXB", topRouteShare: 0.7 },
      { supplierCode: "RATEHAWK", bookings: 2, cancelRefundRate: 0 },
    ]);
    assert.equal(out.available, true);
    assert.ok(out.insights.some((i) => i.kind === "SHARE" && i.supplierCode === "GALILEO"));
    assert.equal(out.autoNegotiate, false);
  });
});

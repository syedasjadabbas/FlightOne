import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateBookingCarbon,
  haversineKm,
  AIRPORT_COORDS,
  FLIGHT_GRAMS_PER_KM,
  CARBON_METHOD_CODE,
} from "./corporate.carbon.js";

describe("carbon estimates", () => {
  it("computes flight CO₂ from published airport coordinates", () => {
    const out = estimateBookingCarbon({
      product: "FLIGHT",
      metadata: { origin: "LHE", destination: "DXB" },
    });
    assert.equal(out.status, "AVAILABLE");
    assert.equal(out.method.code, CARBON_METHOD_CODE);
    const km = haversineKm(AIRPORT_COORDS.LHE, AIRPORT_COORDS.DXB);
    assert.equal(out.gramsCo2e, Math.round(km * FLIGHT_GRAMS_PER_KM));
    assert.equal(out.inputs.origin, "LHE");
  });

  it("does not invent flight CO₂ without a route", () => {
    const out = estimateBookingCarbon({ product: "FLIGHT", metadata: {} });
    assert.equal(out.status, "INSUFFICIENT_DATA");
    assert.equal(out.gramsCo2e, null);
    assert.match(out.reason, /not estimated/i);
  });

  it("does not invent flight CO₂ for unknown airports", () => {
    const out = estimateBookingCarbon({
      product: "FLIGHT",
      metadata: { origin: "ZZZ", destination: "XXX" },
    });
    assert.equal(out.status, "INSUFFICIENT_DATA");
    assert.equal(out.gramsCo2e, null);
  });

  it("computes hotel CO₂ from verified nights", () => {
    const out = estimateBookingCarbon({
      product: "HOTEL",
      metadata: { nights: 3 },
    });
    assert.equal(out.status, "AVAILABLE");
    assert.equal(out.gramsCo2e, 60_000);
  });

  it("does not invent hotel CO₂ without nights", () => {
    const out = estimateBookingCarbon({ product: "HOTEL", metadata: {} });
    assert.equal(out.status, "INSUFFICIENT_DATA");
    assert.equal(out.gramsCo2e, null);
  });
});

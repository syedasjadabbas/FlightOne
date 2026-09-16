/**
 * Travel-history pattern extraction (no DB).
 * Run: node --test modules/profile/history.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTravelHistoryPatterns,
  extractBookingTripSignals,
} from "./historyPatterns.js";

describe("extractBookingTripSignals", () => {
  it("reads nested metadata origin/destination/airline/cabin", () => {
    const signal = extractBookingTripSignals({
      product: "FLIGHT",
      status: "COMPLETED",
      metadata: {
        origin: "lhe",
        destination: "dxb",
        airline: "ey",
        cabin: "business",
      },
    });
    assert.equal(signal.route, "LHE-DXB");
    assert.equal(signal.airline, "EY");
    assert.equal(signal.cabin, "BUSINESS");
  });

  it("falls back to pricing.input / offer shapes", () => {
    const signal = extractBookingTripSignals({
      product: "FLIGHT",
      metadata: {
        pricing: { input: { originCode: "ISB", destinationCode: "JED" } },
        offer: { airlineCode: "PK", cabinClass: "ECONOMY" },
      },
    });
    assert.equal(signal.route, "ISB-JED");
    assert.equal(signal.airline, "PK");
    assert.equal(signal.cabin, "ECONOMY");
  });

  it("ignores invalid airport codes", () => {
    const signal = extractBookingTripSignals({
      metadata: { origin: "LAHORE", destination: "DXB", airline: "??" },
    });
    assert.equal(signal.origin, null);
    assert.equal(signal.destination, "DXB");
    assert.equal(signal.route, null);
    assert.equal(signal.airline, null);
  });
});

describe("buildTravelHistoryPatterns", () => {
  it("ranks frequent routes and airlines without inventing data", () => {
    const patterns = buildTravelHistoryPatterns([
      {
        product: "FLIGHT",
        status: "COMPLETED",
        metadata: { origin: "LHE", destination: "DXB", airline: "EY" },
      },
      {
        product: "FLIGHT",
        status: "TICKETED",
        metadata: { origin: "LHE", destination: "DXB", airline: "EY" },
      },
      {
        product: "FLIGHT",
        status: "QUOTED",
        metadata: { origin: "KHI", destination: "DXB", airline: "PK" },
      },
      {
        product: "HOTEL",
        status: "COMPLETED",
        metadata: { destination: "DXB" },
      },
    ]);
    assert.deepEqual(patterns.frequentRoutes, ["LHE-DXB", "KHI-DXB"]);
    assert.deepEqual(patterns.frequentAirlines, ["EY", "PK"]);
    assert.ok(patterns.recentTrips.length >= 2);
    assert.ok(patterns.productMix.includes("FLIGHT"));
  });
});

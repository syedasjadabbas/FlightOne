/**
 * Lightweight checks for Travelport duration / segment helpers.
 * Run: node --test modules/suppliers/travelport/normalize.duration.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseDurationMinutes,
  buildFlightSegments,
} from "./normalize.js";

describe("parseDurationMinutes", () => {
  it("parses ISO-8601 durations", () => {
    assert.equal(parseDurationMinutes("PT3H20M"), 200);
    assert.equal(parseDurationMinutes("PT2H"), 120);
    assert.equal(parseDurationMinutes(90), 90);
  });
});

describe("buildFlightSegments", () => {
  it("maps flight refs and layover", () => {
    const segs = buildFlightSegments([
      {
        carrier: "EY",
        number: "285",
        equipment: "32A",
        duration: "PT3H20M",
        Departure: { location: "LHE", date: "2026-08-12", time: "04:15:00" },
        Arrival: { location: "AUH", date: "2026-08-12", time: "06:35:00" },
      },
      {
        carrier: "EY",
        number: "5420",
        equipment: "BUS",
        duration: "PT2H",
        Departure: { location: "AUH", date: "2026-08-12", time: "14:15:00" },
        Arrival: { location: "XNB", date: "2026-08-12", time: "16:15:00" },
      },
    ]);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].flightNumber, "EY285");
    assert.equal(segs[0].durationMinutes, 200);
    assert.equal(segs[0].layoverMinutesAfter, 460);
    assert.equal(segs[1].arriveTimeLocal, "16:15");
  });
});

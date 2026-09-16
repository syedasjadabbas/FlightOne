import { describe, expect, it } from "vitest";
import {
  analyzeConnectionWarnings,
  LONG_LAYOVER_MINUTES,
  SHORT_LAYOVER_MINUTES,
} from "./connectionAnalysis";
import type { FlightSegment } from "./types";

function seg(partial: Partial<FlightSegment> & Pick<FlightSegment, "originCode" | "destinationCode">): FlightSegment {
  return {
    carrier: "EY",
    flightNumber: "EY1",
    originCode: partial.originCode,
    destinationCode: partial.destinationCode,
    departureDate: partial.departureDate ?? "2026-09-10",
    departTimeLocal: partial.departTimeLocal ?? "10:00",
    arrivalDate: partial.arrivalDate ?? "2026-09-10",
    arriveTimeLocal: partial.arriveTimeLocal ?? "12:00",
    durationMinutes: partial.durationMinutes ?? 120,
    ...partial,
  };
}

describe("analyzeConnectionWarnings", () => {
  it("flags airport change between segments", () => {
    const warnings = analyzeConnectionWarnings([
      seg({ originCode: "AUH", destinationCode: "XNB", layoverMinutesAfter: 60 }),
      seg({ originCode: "DXB", destinationCode: "LHR", departureDate: "2026-09-10" }),
    ]);
    expect(warnings.some((w) => w.kind === "airport_change")).toBe(true);
  });

  it("flags short layover below threshold", () => {
    const warnings = analyzeConnectionWarnings([
      seg({ originCode: "LHE", destinationCode: "AUH", layoverMinutesAfter: SHORT_LAYOVER_MINUTES - 5 }),
      seg({ originCode: "AUH", destinationCode: "DXB" }),
    ]);
    expect(warnings.some((w) => w.kind === "short_layover")).toBe(true);
  });

  it("flags long layover above threshold", () => {
    const warnings = analyzeConnectionWarnings([
      seg({ originCode: "LHE", destinationCode: "AUH", layoverMinutesAfter: LONG_LAYOVER_MINUTES + 10 }),
      seg({ originCode: "AUH", destinationCode: "DXB" }),
    ]);
    expect(warnings.some((w) => w.kind === "long_layover")).toBe(true);
  });

  it("flags overnight connection", () => {
    const warnings = analyzeConnectionWarnings([
      seg({
        originCode: "LHE",
        destinationCode: "AUH",
        arrivalDate: "2026-09-10",
        layoverMinutesAfter: 300,
      }),
      seg({
        originCode: "AUH",
        destinationCode: "DXB",
        departureDate: "2026-09-11",
      }),
    ]);
    expect(warnings.some((w) => w.kind === "overnight_connection")).toBe(true);
  });
});

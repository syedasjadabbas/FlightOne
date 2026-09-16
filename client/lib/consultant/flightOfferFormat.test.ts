import { describe, expect, it } from "vitest";
import {
  formatDurationLabel,
  stopsLabel,
  cabinLabel,
  baggageAllowanceLabel,
  refundableFareLabel,
  FARE_RULES_UNAVAILABLE,
} from "../../app/components/flightOfferFormat";
import { BAGGAGE_UNAVAILABLE } from "../inventory/fareDisplay";

describe("flightOfferFormat", () => {
  it("formats duration short and long", () => {
    expect(formatDurationLabel(195)).toBe("3h 15");
    expect(formatDurationLabel(195, "long")).toBe("3 hrs 15 mins");
    expect(formatDurationLabel(60)).toBe("1h");
  });

  it("labels stops and cabin", () => {
    expect(stopsLabel(0)).toBe("Direct");
    expect(stopsLabel(1)).toBe("1 stop");
    expect(cabinLabel("economy")).toBe("Economy Class");
  });

  it("labels unknown baggage and fare rules", () => {
    expect(baggageAllowanceLabel(undefined)).toBe(BAGGAGE_UNAVAILABLE);
    expect(baggageAllowanceLabel(23)).toBe("23kg checked");
    expect(refundableFareLabel(undefined)).toBe(FARE_RULES_UNAVAILABLE);
    expect(refundableFareLabel(false)).toBe("Non-refundable");
    expect(refundableFareLabel(true)).toBe("Refundable");
  });
});

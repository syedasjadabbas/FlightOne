import { describe, expect, it } from "vitest";
import { isValidGroupPassengerCount, MIN_GROUP_PASSENGERS } from "./groupRequest";

describe("groupRequest", () => {
  it("enforces the 10-passenger minimum", () => {
    expect(MIN_GROUP_PASSENGERS).toBe(10);
    expect(isValidGroupPassengerCount(9)).toBe(false);
    expect(isValidGroupPassengerCount(10)).toBe(true);
    expect(isValidGroupPassengerCount(12)).toBe(true);
  });
});

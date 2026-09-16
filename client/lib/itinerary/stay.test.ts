import { describe, expect, it } from "vitest";
import { calendarDaysBetween, calendarNightsBetween } from "./stay";

describe("calendarNightsBetween", () => {
  it("counts nights as calendar day difference", () => {
    expect(calendarNightsBetween("2026-06-04", "2026-06-06")).toBe(2);
    expect(calendarNightsBetween("2026-06-06", "2026-06-21")).toBe(15);
    expect(calendarNightsBetween("2026-06-06", "2026-06-06")).toBe(0);
  });

  it("rejects inverted or bad dates", () => {
    expect(calendarNightsBetween("2026-06-06", "2026-06-04")).toBeNull();
    expect(calendarNightsBetween("nope", "2026-06-04")).toBeNull();
  });

  it("days alias matches nights convention", () => {
    expect(calendarDaysBetween("2026-06-06", "2026-06-21")).toBe(15);
  });
});

import { describe, expect, it } from "vitest";
import {
  fareActionLabel,
  fareStatusLabel,
  formatFareMinor,
} from "@/lib/recommendation/predictiveDisplay";

describe("predictiveDisplay", () => {
  it("does not present book-now as a guaranteed saving", () => {
    expect(fareActionLabel("BOOK_NOW")).toMatch(/may be useful/i);
    expect(fareStatusLabel("INFERENCE")).toMatch(/not a guarantee/i);
  });

  it("labels insufficient fare history honestly", () => {
    expect(fareActionLabel("NOT_ENOUGH_DATA")).toMatch(/not enough data/i);
    expect(fareStatusLabel("INSUFFICIENT_DATA")).toMatch(/not enough/i);
  });

  it("formats verified current fares in major units", () => {
    expect(formatFareMinor(125000, "PKR")).toContain("PKR");
    expect(formatFareMinor(null, "PKR")).toBe("—");
  });
});

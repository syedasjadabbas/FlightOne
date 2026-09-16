import { describe, expect, it } from "vitest";
import {
  applyCorporateConstraintsToPrefs,
  formatCorporateConstraintsForPrompt,
} from "./corporateConstraints";

describe("corporateConstraints (Module 06 Ava soft hints)", () => {
  it("formats authoritative corporate policy for the prompt", () => {
    const line = formatCorporateConstraintsForPrompt({
      maxCabin: "ECONOMY",
      maxAmountMinor: 50000,
      preferredAirlines: ["PK", "EK"],
      advanceBookingDays: 7,
      authoritative: true,
    });
    expect(line).toMatch(/authoritative/i);
    expect(line).toMatch(/ECONOMY/);
    expect(line).toMatch(/PK/);
  });

  it("fills preference gaps from corporate policy without inventing overrides", () => {
    const merged = applyCorporateConstraintsToPrefs(
      { preferredCabin: null },
      { maxCabin: "ECONOMY", preferredAirlines: ["PK"] },
    );
    expect(merged?.preferredCabin).toBe("ECONOMY");
    expect(merged?.preferredAirlines).toEqual(["PK"]);

    const kept = applyCorporateConstraintsToPrefs(
      { preferredCabin: "BUSINESS", preferredAirlines: ["QR"] },
      { maxCabin: "ECONOMY", preferredAirlines: ["PK"] },
    );
    expect(kept?.preferredCabin).toBe("BUSINESS");
    expect(kept?.preferredAirlines).toEqual(["QR"]);
  });
});

import { describe, expect, it } from "vitest";
import { placeToIata, iataToPlace, airportLabel } from "./places";

describe("Sharjah place mapping (regression: 'find fare lhe-shj-lhe' typed as a city name)", () => {
  it("resolves the city name to SHJ", () => {
    expect(placeToIata("Sharjah")).toBe("SHJ");
    expect(placeToIata("sharjah")).toBe("SHJ");
  });

  it("resolves SHJ back to a real place / airport label, not a bare code", () => {
    expect(iataToPlace("SHJ")).toBe("Sharjah");
    expect(airportLabel("SHJ")).toBe("Sharjah");
  });
});

import { describe, expect, it } from "vitest";
import { altAirports, airportsForMetro, metroCanonical, sameMetro } from "./altAirports";

describe("altAirports (regression: 'return can be from any city in UAE' dropped Abu Dhabi)", () => {
  it("DXB's metro group lists UAE alternates including AUH", () => {
    expect(airportsForMetro("DXB")).toEqual(["DXB", "DWC", "SHJ", "AUH", "XNB"]);
  });

  it("altAirports(DXB, 3) includes Abu Dhabi — the old default of 2 silently dropped it", () => {
    const alts = altAirports("DXB", 3);
    expect(alts).toContain("AUH");
    expect(alts).toContain("SHJ");
    expect(alts).toContain("DWC");
    expect(alts).toHaveLength(3);
  });

  it("altAirports(DXB, 2) — documenting the old, too-small default's actual behavior", () => {
    // This is the exact bug: with max=2, Abu Dhabi never got searched.
    // resolveFlightComps now calls altAirports(dest, 3), not 2 — see
    // flightComps.ts. Kept here so a future regression to `2` is caught.
    const alts = altAirports("DXB", 2);
    expect(alts).not.toContain("AUH");
  });
});

describe("sameMetro symmetry (regression: Lahore→Norfolk/return-from-IAD open-jaw rejected despite real inventory on both legs)", () => {
  it("IAD and ORF canonicalize to the same metro root regardless of lookup direction", () => {
    expect(metroCanonical("IAD")).toBe(metroCanonical("ORF"));
    expect(sameMetro("IAD", "ORF")).toBe(true);
    expect(sameMetro("ORF", "IAD")).toBe(true);
  });

  it("every WAS-area gateway (IAD/DCA/BWI/PHF) canonicalizes with ORF", () => {
    for (const code of ["IAD", "DCA", "BWI", "PHF"]) {
      expect(sameMetro(code, "ORF")).toBe(true);
    }
  });

  it("AUH and DXB are the same metro both directions (old bug: only DXB→AUH worked)", () => {
    expect(sameMetro("AUH", "DXB")).toBe(true);
    expect(sameMetro("DXB", "AUH")).toBe(true);
  });

  it("SFO/OAK/SJC all canonicalize together even though each has its own table entry", () => {
    expect(metroCanonical("SFO")).toBe(metroCanonical("OAK"));
    expect(metroCanonical("SFO")).toBe(metroCanonical("SJC"));
    expect(sameMetro("OAK", "SJC")).toBe(true);
  });

  it("unrelated airports are still not the same metro", () => {
    expect(sameMetro("ORF", "SFO")).toBe(false);
    expect(sameMetro("LHE", "DXB")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { findDemoFlights } from "@/lib/demo/demoInventory";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";

const q = (o: Partial<FlightSearchQuery>) => o as FlightSearchQuery;

describe("arbitrary multi-leg asks", () => {
  const trips = [
    { n: "EU 3-leg, unlisted dates", legs: [["LHE","CDG","2026-12-03"],["CDG","FCO","2026-12-08"],["FCO","LHE","2026-12-14"]] },
    { n: "US 4-leg reverse-heavy", legs: [["KHI","JFK","2027-01-05"],["JFK","LAX","2027-01-10"],["LAX","DXB","2027-01-15"],["DXB","KHI","2027-01-18"]] },
    { n: "Asia 3-leg", legs: [["ISB","BKK","2026-12-20"],["BKK","HKG","2026-12-25"],["HKG","ISB","2026-12-30"]] },
    { n: "reverse-only legs", legs: [["BCN","LHE","2026-12-01"],["LHE","MLE","2026-12-05"],["MLE","BCN","2026-12-12"]] },
  ];
  for (const t of trips) {
    it(`serves every leg: ${t.n}`, () => {
      const empty: string[] = [];
      for (const [o, d, date] of t.legs) {
        const hits = findDemoFlights(q({ origin: o, destination: d, departureDate: date, cabinClass: "ECONOMY" }));
        if (hits.length === 0) empty.push(`${o}-${d} ${date}`);
        else {
          expect(hits[0].originCode).toBe(o);
          expect(hits[0].destinationCode).toBe(d);
          expect(hits[0].departureDate).toBe(date);
        }
      }
      expect(empty).toEqual([]);
    });
  }

  it("serves a business-class multi-leg on economy-only routes", () => {
    const empty: string[] = [];
    for (const [o, d, date] of [["LHE","BKK","2026-12-02"],["BKK","SIN","2026-12-07"],["SIN","LHE","2026-12-12"]]) {
      const hits = findDemoFlights(q({ origin: o, destination: d, departureDate: date, cabinClass: "BUSINESS" }));
      if (hits.length === 0) empty.push(`${o}-${d}`);
      else expect(hits.every((h) => h.cabin === "business")).toBe(true);
    }
    expect(empty).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import corpus from "./galileo-fares.json";
import { findDemoFlights } from "./demoInventory";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";

/** Any leg of any multi-city ask must return something, or the trip breaks. */
describe("demo corpus route coverage", () => {
  const codes = [
    ...new Set(corpus.systemOffers.flatMap((o) => [o.originCode, o.destinationCode])),
  ].sort();

  it("serves the overwhelming majority of arbitrary city pairs", () => {
    let served = 0;
    let total = 0;
    const missing: string[] = [];
    for (const a of codes) {
      for (const b of codes) {
        if (a === b) continue;
        total += 1;
        const hits = findDemoFlights({
          origin: a,
          destination: b,
          departureDate: "2026-12-10",
          cabinClass: "ECONOMY",
        } as FlightSearchQuery);
        if (hits.length > 0) served += 1;
        else missing.push(`${a}-${b}`);
      }
    }
    const pct = (served / total) * 100;
    // Baseline before route fallbacks: 130/1722 = 7.5% on an arbitrary date.
    // After adding 487 REAL airline routes (see realroutes.cjs) plus the
    // date/reverse/cabin/stitch fallbacks: 100%. Guard at 99 so a corpus
    // rebuild that loses routes fails loudly rather than degrading quietly.
    expect(pct).toBeGreaterThan(99);
    expect(missing.length).toBeLessThan(total * 0.01);
  });

  it("never returns an absurdly long stitched itinerary", () => {
    for (const a of codes.slice(0, 12)) {
      for (const b of codes.slice(0, 12)) {
        if (a === b) continue;
        for (const o of findDemoFlights({
          origin: a,
          destination: b,
          departureDate: "2026-12-10",
          cabinClass: "ECONOMY",
        } as FlightSearchQuery)) {
          expect(o.segments?.length ?? 0).toBeLessThanOrEqual(6);
          expect(o.originCode).toBe(a);
          expect(o.destinationCode).toBe(b);
          // A stitched multi-ticket must not masquerade as a quotable fare.
          if (o.tags.includes("stitched")) {
            expect(o.supplierOfferSnapshotId).toBeUndefined();
          }
        }
      }
    }
  });
});

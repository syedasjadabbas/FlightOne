import { describe, expect, it } from "vitest";
import { extractExplicitSlotOverrides } from "./slotOverrides";
import { filterScoredOffersForActiveQuery } from "./planSearchIntegrity";
import type { ScoredOffer } from "@/lib/recommendation/recommendation";
import type { Offer } from "@/lib/inventory/types";

const OPTS = {
  today: "2026-09-01",
  defaultOriginIata: "LHE",
  defaultOriginPlace: "Lahore",
  previousOrigin: "LHE",
  previousDestination: "DXB",
};

describe("extractExplicitSlotOverrides", () => {
  it("detects China as unresolved and clears destination intent", () => {
    const o = extractExplicitSlotOverrides(
      "i wanna go to china from lahore on 15 sept",
      OPTS,
    );
    expect(o.destinationChanged).toBe(true);
    expect(o.destinationUnresolved).toBe("china");
    expect(o.destinationClarifyAsk).toMatch(/China/i);
    expect(o.origin).toBe("LHE");
    expect(o.departureDate).toBe("2026-09-15");
    expect(o.destination).toBeUndefined();
  });

  it("detects Istanbul instead", () => {
    const o = extractExplicitSlotOverrides("I want Istanbul instead", OPTS);
    expect(o.destination).toBe("IST");
    expect(o.destinationChanged).toBe(true);
  });

  it("detects from Karachi instead without changing destination", () => {
    const o = extractExplicitSlotOverrides("from Karachi instead", OPTS);
    expect(o.origin).toBe("KHI");
    expect(o.originChanged).toBe(true);
    expect(o.destination).toBeUndefined();
  });

  it("detects date override Make it Sep 15", () => {
    const o = extractExplicitSlotOverrides("Make it Sep 15", OPTS);
    expect(o.departureDate).toBe("2026-09-15");
    expect(o.departureDateExplicit).toBe(true);
    expect(o.destination).toBeUndefined();
  });

  it("beijing on 10 sept → PEK + date (beats stale DXB)", () => {
    const o = extractExplicitSlotOverrides("beijing on 10 sept", OPTS);
    expect(o.destination).toBe("PEK");
    expect(o.destinationChanged).toBe(true);
    expect(o.departureDate).toBe("2026-09-10");
    expect(o.departureDateExplicit).toBe(true);
  });

  it("Actually from Karachi. → KHI only", () => {
    const o = extractExplicitSlotOverrides("Actually from Karachi.", {
      ...OPTS,
      previousOrigin: "LHE",
      previousDestination: "LHR",
    });
    expect(o.origin).toBe("KHI");
    expect(o.originChanged).toBe(true);
    expect(o.destination).toBeUndefined();
  });

  it("I want Dubai instead. → DXB only, not default LHE origin", () => {
    const o = extractExplicitSlotOverrides("I want Dubai instead.", {
      ...OPTS,
      previousOrigin: "KHI",
      previousDestination: "LHR",
    });
    expect(o.destination).toBe("DXB");
    expect(o.destinationChanged).toBe(true);
    expect(o.origin).toBeUndefined();
  });

  it("No, London instead. → LHR", () => {
    const o = extractExplicitSlotOverrides("No, London instead.", {
      ...OPTS,
      previousOrigin: "LHE",
      previousDestination: "IST",
    });
    expect(o.destination).toBe("LHR");
    expect(o.destinationChanged).toBe(true);
  });
});

describe("filterScoredOffersForActiveQuery", () => {
  function scoredFlight(origin: string, destination: string, date: string): ScoredOffer {
    return {
      priced: {
        offer: {
          id: `${origin}-${destination}`,
          type: "flight",
          title: "Test",
          originCode: origin,
          destinationCode: destination,
          departureDate: date,
          price: { amount: 100, currency: "PKR" },
        } as unknown as Offer,
        customerPrice: { amount: 100, currency: "PKR" },
        marginMinor: 0,
        savingsVsMarket: { amount: 0, currency: "PKR" },
        aiFloorPrice: { amount: 100, currency: "PKR" },
      } as unknown as ScoredOffer["priced"],
      score: 80,
      reasons: [],
      angle: "best_value",
    };
  }

  it("drops DXB offers when active query is IST", () => {
    const scored = [
      scoredFlight("LHE", "DXB", "2026-09-10"),
      scoredFlight("LHE", "IST", "2026-09-15"),
    ];
    const filtered = filterScoredOffersForActiveQuery(scored, {
      origin: "LHE",
      destination: "IST",
      departureDate: "2026-09-15",
      passengers: 1,
    });
    expect(filtered).toHaveLength(1);
    expect((filtered[0].priced.offer as { destinationCode: string }).destinationCode).toBe(
      "IST",
    );
  });
});

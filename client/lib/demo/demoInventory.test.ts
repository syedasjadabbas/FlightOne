import { describe, expect, it, beforeEach, afterEach } from "vitest";
import corpus from "./galileo-fares.json";
import { findDemoFlights, isDemoInventoryEnabled } from "./demoInventory";
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";

/** Guards that every advertised demo query actually returns inventory. */

const q = (over: Partial<FlightSearchQuery>): FlightSearchQuery =>
  ({ origin: "LHE", destination: "DXB", departureDate: "2026-10-15", ...over }) as FlightSearchQuery;

describe("demo inventory flag", () => {
  const prev = process.env.DEMO_FLIGHT_INVENTORY;
  afterEach(() => {
    process.env.DEMO_FLIGHT_INVENTORY = prev;
  });

  it("is off unless explicitly set to true", () => {
    delete process.env.DEMO_FLIGHT_INVENTORY;
    expect(isDemoInventoryEnabled()).toBe(false);
    process.env.DEMO_FLIGHT_INVENTORY = "1";
    expect(isDemoInventoryEnabled()).toBe(false);
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    expect(isDemoInventoryEnabled()).toBe(true);
  });
});

describe("findDemoFlights", () => {
  it("serves every query advertised in the corpus index", () => {
    const empty: string[] = [];
    for (const entry of corpus.queries) {
      const hits = findDemoFlights(
        q({
          origin: entry.origin,
          destination: entry.destination,
          departureDate: entry.departureDate,
          ...(entry.returnDate ? { returnDate: entry.returnDate } : {}),
          cabinClass:
            entry.cabin === "business"
              ? "BUSINESS"
              : entry.cabin === "premium"
                ? "PREMIUM_ECONOMY"
                : "ECONOMY",
        }),
      );
      if (hits.length !== entry.offers) {
        empty.push(`${entry.searchId}: got ${hits.length}, indexed ${entry.offers}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it("does not answer a one-way ask with a round-trip fare", () => {
    const oneWay = findDemoFlights(q({ departureDate: "2026-10-15" }));
    expect(oneWay.length).toBeGreaterThan(0);
    expect(oneWay.every((o) => !o.returnSegments?.length)).toBe(true);

    const round = findDemoFlights(q({ departureDate: "2026-10-15", returnDate: "2026-10-25" }));
    expect(round.length).toBeGreaterThan(0);
    expect(round.every((o) => (o.returnSegments?.length ?? 0) > 0)).toBe(true);
  });

  it("separates cabins on the same route and date", () => {
    const econ = findDemoFlights(q({ destination: "LHR", departureDate: "2026-10-18", cabinClass: "ECONOMY" }));
    const biz = findDemoFlights(q({ destination: "LHR", departureDate: "2026-10-18", cabinClass: "BUSINESS" }));
    expect(econ.length).toBeGreaterThan(0);
    expect(biz.length).toBeGreaterThan(0);
    expect(econ.every((o) => o.cabin === "economy")).toBe(true);
    expect(biz.every((o) => o.cabin === "business")).toBe(true);
    // Business must not be cheaper than economy on the same route/date.
    expect(Math.min(...biz.map((o) => o.netFare.amount))).toBeGreaterThan(
      Math.max(...econ.map((o) => o.netFare.amount)),
    );
  });

  it("rebases the nearest priced date onto an uncovered date", () => {
    // Most corpus routes carry a single date. Returning nothing left every
    // multi-leg itinerary broken, so an uncovered date now shifts the nearest
    // fare rather than coming back empty.
    const hits = findDemoFlights(q({ departureDate: "2027-01-01" }));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((o) => o.departureDate === "2027-01-01")).toBe(true);
    // Sectors must move with it, or the ticket prints last year's dates.
    expect(hits.every((o) => o.segments?.[0]?.departureDate === "2027-01-01")).toBe(true);
  });

  it("keeps sector durations and the fare intact when shifting dates", () => {
    // LHE-DXB is priced on 15 Oct and 14 Nov, so a December ask rebases from
    // the NEARER set (14 Nov) — compare against that, not the earlier one.
    const [exact] = findDemoFlights(q({ departureDate: "2026-11-14" }));
    const [shifted] = findDemoFlights(q({ departureDate: "2026-12-01" }));
    expect(shifted.netFare.amount).toBe(exact.netFare.amount);
    expect(shifted.durationMinutes).toBe(exact.durationMinutes);
    expect(shifted.segments?.map((s) => s.durationMinutes)).toEqual(
      exact.segments?.map((s) => s.durationMinutes),
    );
    // A shifted offer is a distinct sellable — ids must not collide.
    expect(shifted.id).not.toBe(exact.id);
  });

  it("rebases from the NEAREST priced date, not the first one", () => {
    // LHE-DXB is priced on 15 Oct and 14 Nov.
    const nov = findDemoFlights(q({ departureDate: "2026-11-14" }));
    const oct = findDemoFlights(q({ departureDate: "2026-10-15" }));
    const decAsk = findDemoFlights(q({ departureDate: "2026-12-01" }));
    const novFares = new Set(nov.map((o) => o.netFare.amount));
    const octOnly = oct
      .map((o) => o.netFare.amount)
      .filter((a) => !novFares.has(a));
    expect(octOnly.length).toBeGreaterThan(0);
    expect(decAsk.some((o) => octOnly.includes(o.netFare.amount))).toBe(false);
  });

  it("returns nothing for a route the corpus has never priced", () => {
    expect(findDemoFlights(q({ origin: "LHE", destination: "GRU" }))).toEqual([]);
  });

  it("mirrors a priced direction when only the reverse exists", () => {
    // Corpus has LHE→BCN but not BCN→LHE.
    const hits = findDemoFlights(
      q({ origin: "BCN", destination: "LHE", departureDate: "2026-11-30" }),
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const o of hits) {
      expect(o.originCode).toBe("BCN");
      expect(o.destinationCode).toBe("LHE");
      expect(o.segments?.[0]?.originCode).toBe("BCN");
      expect(o.segments?.[o.segments.length - 1]?.destinationCode).toBe("LHE");
    }
  });

  it("derives a business fare when the route is economy-only", () => {
    const econ = findDemoFlights(
      q({ destination: "BKK", departureDate: "2026-10-19", cabinClass: "ECONOMY" }),
    );
    const biz = findDemoFlights(
      q({ destination: "BKK", departureDate: "2026-10-19", cabinClass: "BUSINESS" }),
    );
    expect(econ.length).toBeGreaterThan(0);
    expect(biz.length).toBeGreaterThan(0);
    expect(biz.every((o) => o.cabin === "business")).toBe(true);
    // Business must never undercut the economy fare it was derived from.
    expect(Math.min(...biz.map((o) => o.netFare.amount))).toBeGreaterThan(
      Math.max(...econ.map((o) => o.netFare.amount)),
    );
  });

  it("ranks preferred carriers first without dropping the rest", () => {
    const all = findDemoFlights(q({ departureDate: "2026-10-15" }));
    const ranked = findDemoFlights(q({ departureDate: "2026-10-15", preferredCarriers: ["PK"] }));
    expect(ranked).toHaveLength(all.length);
    expect(ranked[0].segments?.[0]?.carrier).toBe("PK");
  });
});

describe("multi-city journeys", () => {
  it("resolves every leg of every journey through the demo search", () => {
    const broken: string[] = [];
    for (const journey of corpus.journeys) {
      for (const leg of journey.legs) {
        const hits = findDemoFlights(
          q({
            origin: leg.origin,
            destination: leg.destination,
            departureDate: leg.departureDate,
            cabinClass: journey.cabin === "business" ? "BUSINESS" : "ECONOMY",
          }),
        );
        // The planner searches each leg independently — one empty leg breaks
        // the whole itinerary assembly.
        if (hits.length === 0) {
          broken.push(`${journey.id}: ${leg.origin}-${leg.destination} ${leg.departureDate}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("covers genuinely multi-leg journeys, not just round trips", () => {
    expect(corpus.journeys.length).toBeGreaterThanOrEqual(15);
    expect(corpus.journeys.filter((j) => j.legCount >= 3).length).toBeGreaterThanOrEqual(10);
    expect(corpus.journeys.some((j) => j.legCount >= 4)).toBe(true);
  });

  it("advertises at least 50 searchable queries", () => {
    expect(corpus.queries.length + corpus.journeys.length).toBeGreaterThanOrEqual(50);
  });
});

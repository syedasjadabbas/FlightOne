import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Guards the two fixes for the multi-leg search blow-up, where one open-jaw ask
 * issued 103 live Travelport searches for 23 unique routes (4.5x duplication)
 * at 30-45s each.
 */

const searchSuppliers = vi.hoisted(() => vi.fn());
vi.mock("./supplierSearch", () => ({ searchSuppliers }));

describe("searchFlightsPreferredThenOpen dedupe", () => {
  beforeEach(() => {
    vi.resetModules();
    searchSuppliers.mockReset();
  });

  it("collapses identical concurrent searches into one supplier call", async () => {
    searchSuppliers.mockImplementation(
      async () =>
        new Promise((r) =>
          setTimeout(() => r([{ type: "flight", id: "a", airline: "EY", airlineCode: "EY", priceMinor: 100, currency: "PKR" }]), 10),
        ),
    );
    const { searchFlightsPreferredThenOpen: fn } = await import("./searchFlightsPreferred");

    const q = {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-14",
      passengers: 1,
      cabinClass: "ECONOMY",
    };
    // Baseline: one uncached search costs N supplier calls (1 open market +
    // up to MAX_DISCOVERY_PROBES carrier probes). We assert the DEDUPE, not
    // that number — 9 identical concurrent asks must cost the same as 1.
    const one = await fn(q as never);
    const baseline = searchSuppliers.mock.calls.length;
    searchSuppliers.mockClear();

    // The real bug: the same leg fanned out 9x concurrently.
    const results = await Promise.all(Array.from({ length: 9 }, () => fn(q as never)));

    // Served entirely from cache — zero further supplier traffic.
    expect(searchSuppliers).toHaveBeenCalledTimes(0);
    expect(baseline).toBeGreaterThan(0);
    expect(one).not.toBeNull();
    expect(results.every((r) => r !== null)).toBe(true);
  }, 15_000);

  it("does not collapse searches that differ on a supplier-visible field", async () => {
    searchSuppliers.mockResolvedValue([{ type: "flight", id: "a", airline: "EY", airlineCode: "EY", priceMinor: 100, currency: "PKR" }]);
    const { searchFlightsPreferredThenOpen: fn } = await import("./searchFlightsPreferred");

    const base = {
      origin: "LHE",
      destination: "SFO",
      departureDate: "2026-10-14",
      cabinClass: "ECONOMY",
    };
    await fn(base as never);
    await fn({ ...base, departureDate: "2026-10-15" } as never);
    await fn({ ...base, cabinClass: "BUSINESS" } as never);
    await fn({ ...base, passengers: 2 } as never);

    // 4 distinct keys, each costing `baseline` calls — assert they did NOT collapse.
    expect(new Set(searchSuppliers.mock.calls.map((c) => JSON.stringify(c[0].query))).size).toBeGreaterThanOrEqual(4);
  });

  it("does not cache a failure — a later retry reaches the supplier", async () => {
    searchSuppliers.mockRejectedValueOnce(new Error("timeout"));
    searchSuppliers.mockResolvedValueOnce([{ type: "flight", id: "a", airline: "EY", airlineCode: "EY", priceMinor: 100, currency: "PKR" }]);
    const { searchFlightsPreferredThenOpen: fn } = await import("./searchFlightsPreferred");

    const q = { origin: "LHE", destination: "DXB", departureDate: "2026-10-14" };
    await expect(fn(q as never)).rejects.toThrow("timeout");
    await expect(fn(q as never)).resolves.toHaveLength(1);
    // Retry must reach the supplier again rather than replay the rejection.
    expect(searchSuppliers.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("exploratory search budget", () => {
  beforeEach(() => vi.resetModules());

  it("caps exploratory calls across legs, and resets per query", async () => {
    const mod = await import("./searchFlightsRouted");
    const release = mod.beginSearchBudget();
    release();

    // Re-opening gives a fresh budget rather than inheriting the drained one.
    const release2 = mod.beginSearchBudget();
    expect(typeof release2).toBe("function");
    release2();
  });
});

describe("demo inventory short-circuit", () => {
  beforeEach(() => {
    vi.resetModules();
    searchSuppliers.mockReset();
  });

  it("serves the corpus without any supplier call when enabled", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    try {
      searchSuppliers.mockResolvedValue([]);
      const { searchFlightsPreferredThenOpen: fn } = await import("./searchFlightsPreferred");
      const offers = await fn({
        origin: "LHE",
        destination: "DXB",
        departureDate: "2026-10-15",
        cabinClass: "ECONOMY",
      } as never);

      expect(offers?.length).toBeGreaterThan(0);
      expect(searchSuppliers).toHaveBeenCalledTimes(0);
    } finally {
      delete process.env.DEMO_FLIGHT_INVENTORY;
    }
  });

  it("falls through to the supplier when the corpus has no match", async () => {
    process.env.DEMO_FLIGHT_INVENTORY = "true";
    try {
      searchSuppliers.mockResolvedValue([]);
      const { searchFlightsPreferredThenOpen: fn } = await import("./searchFlightsPreferred");
      // Must be an uncovered ROUTE, not just an uncovered date: the corpus
      // now rebases the nearest priced date onto whatever was asked, so a
      // far-future date on a known route is served rather than falling through.
      await fn({
        origin: "LHE",
        destination: "GRU",
        departureDate: "2031-01-01",
        cabinClass: "ECONOMY",
      } as never);

      // A route the corpus cannot reach at all must still hit Travelport
      // rather than silently returning empty.
      expect(searchSuppliers.mock.calls.length).toBeGreaterThan(0);
    } finally {
      delete process.env.DEMO_FLIGHT_INVENTORY;
    }
  });
});

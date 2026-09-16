import { describe, expect, it } from "vitest";
import {
  buildLegGdsDiagnostics,
  buildLegRoute,
  buildMultiCityDateClarify,
  buildTripTitle,
  clonePlanWithOrigin,
  detectScopeConflict,
  dualOriginTargets,
  isCheapestDatePatternRequest,
  isMultiCitySearch,
  mentionsLheIsbCompare,
  needsMultiCityDates,
} from "./multiCity";
import type { SearchPlan } from "./multiCity";

const multiCityPlan: SearchPlan = {
  action: "search",
  datesAssumed: true,
  searches: [
    {
      product: "FLIGHT",
      query: { origin: "LHE", destination: "LON", departureDate: "2026-10-05", passengers: 1 },
    },
    {
      product: "FLIGHT",
      query: { origin: "LON", destination: "NYC", departureDate: "2026-10-08", passengers: 1 },
    },
    {
      product: "FLIGHT",
      query: { origin: "NYC", destination: "MIA", departureDate: "2026-10-20", passengers: 1 },
    },
    {
      product: "FLIGHT",
      query: { origin: "MIA", destination: "LHE", departureDate: "2026-10-25", passengers: 1 },
    },
  ],
};

describe("isMultiCitySearch", () => {
  it("detects 3+ flight legs", () => {
    expect(isMultiCitySearch(multiCityPlan)).toBe(true);
    expect(
      isMultiCitySearch({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: { origin: "LHE", destination: "DXB", departureDate: "2026-10-01" },
          },
          {
            product: "FLIGHT",
            query: { origin: "DXB", destination: "LHE", departureDate: "2026-10-10" },
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("scope and origin compare", () => {
  it("detects LHE/ISB compare intent", () => {
    expect(mentionsLheIsbCompare("Compare Lahore vs Islamabad multi-city")).toBe(true);
    expect(dualOriginTargets("Compare Lahore vs Islamabad multi-city")).toEqual(["LHE", "ISB"]);
  });

  it("forces scope choice when origin and airline compare collide", () => {
    const conflict = detectScopeConflict(
      "Compare ISB and Emirates vs alternatives on a multi-city trip",
      { preferredAirlines: ["EK"] },
    );
    expect(conflict).not.toBeNull();
    expect(conflict?.suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("does not conflict when only origin compare", () => {
    expect(detectScopeConflict("Compare Lahore vs Islamabad", undefined)).toBeNull();
  });
});

describe("date clarify", () => {
  it("does not block multi-city when every leg has a date (even if assumed)", () => {
    expect(needsMultiCityDates(multiCityPlan)).toBe(false);
  });

  it("blocks when a flight leg is missing departureDate", () => {
    const incomplete = {
      ...multiCityPlan,
      searches: multiCityPlan.searches.map((s, i) =>
        i === 0 && s.product === "FLIGHT"
          ? { ...s, query: { ...s.query, departureDate: undefined as unknown as string } }
          : s,
      ),
    };
    expect(needsMultiCityDates(incomplete)).toBe(true);
  });

  it("builds per-segment clarify copy", () => {
    const { ask, suggestions } = buildMultiCityDateClarify(multiCityPlan, "Lahore");
    expect(ask).toContain("Segment 1");
    expect(ask).toContain("LHE → LON");
    expect(suggestions.length).toBe(3);
  });

  it("refuses cheapest date pattern requests", () => {
    expect(isCheapestDatePatternRequest("Find the cheapest date pattern for each segment")).toBe(
      true,
    );
  });
});

describe("leg presentation", () => {
  it("builds leg route chain", () => {
    expect(buildLegRoute(multiCityPlan)).toBe("LHE → LON → NYC → MIA → LHE");
  });

  it("builds fare compare title", () => {
    expect(buildTripTitle(multiCityPlan, "Compare Lahore and Islamabad")).toBe(
      "Multi-City Fare Compare",
    );
  });

  it("clones plan with alternate origin", () => {
    const isb = clonePlanWithOrigin(multiCityPlan, "ISB");
    expect(buildLegRoute(isb, "ISB")).toBe("ISB → LON → NYC → MIA → ISB");
    expect(isb.searches[0].product === "FLIGHT" && isb.searches[0].query.origin).toBe("ISB");
    const last = isb.searches[isb.searches.length - 1];
    expect(last.product === "FLIGHT" && last.query.destination).toBe("ISB");
  });
});

describe("buildLegGdsDiagnostics", () => {
  it("explains partial GDS coverage", () => {
    const msg = buildLegGdsDiagnostics([
      { legRoute: "LHE → LHR", totalCount: 9, live: true },
      { legRoute: "LHR → IAD", totalCount: 0, live: false },
      { legRoute: "MIA → LHE", totalCount: 0, live: false },
    ]);
    expect(msg).toContain("partial inventory");
    expect(msg).toContain("LHE → LHR: 9 live GDS fares");
    expect(msg).toContain("LHR → IAD: no GDS inventory");
  });

  it("labels Google Flights web-filled legs", () => {
    const msg = buildLegGdsDiagnostics([
      { legRoute: "LHE → LHR", totalCount: 9, live: true },
      { legRoute: "LHR → SFO", totalCount: 12, live: false, web: true },
    ]);
    expect(msg).toContain(
      "LHR → SFO: 12 market options (Google Flights reference — not bookable here)",
    );
  });
});

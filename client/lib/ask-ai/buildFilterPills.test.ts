import { describe, expect, it } from "vitest";
import { buildFilterPills, buildQueryLabel } from "./buildFilterPills";

describe("buildFilterPills", () => {
  it("builds nonstop and airline pills from intent filters", () => {
    const pills = buildFilterPills({
      offTopic: false,
      type: "flight",
      origin: "Lahore",
      destination: "Dubai",
      filters: {
        nonstopOnly: true,
        preferredAirlines: ["EK"],
      },
    });
    expect(pills.some((p) => p.kind === "nonstop" && p.active)).toBe(true);
    expect(pills.some((p) => p.id === "airline_EK")).toBe(true);
  });

  it("includes date range pill", () => {
    const pills = buildFilterPills({
      offTopic: false,
      departureDate: "2026-09-22",
      returnDate: "2026-10-03",
    });
    expect(pills.some((p) => p.kind === "dates")).toBe(true);
  });
});

describe("buildQueryLabel", () => {
  it("formats origin destination and party", () => {
    const label = buildQueryLabel(
      {
        offTopic: false,
        origin: "LHE",
        destination: "DXB",
        passengers: 2,
      },
      "Lahore",
    );
    expect(label).toContain("LHE → DXB");
    expect(label).toContain("2 travellers");
  });
});

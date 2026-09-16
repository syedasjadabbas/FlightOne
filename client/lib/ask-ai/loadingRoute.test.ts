import { describe, expect, it } from "vitest";
import { previewLoadingRoute, routeCodesFromTravelPlan } from "./loadingRoute";
import { mergeTravelPlan, firstFlightQuery } from "@/lib/consultant/mergeTravelPlan";
import type { TravelPlan } from "@/lib/consultant/travelPlan";

const OPTS = {
  today: "2026-09-02",
  defaultOriginIata: "LHE",
  defaultOriginPlace: "Lahore",
  history: [] as { role: "user" | "assistant"; content: string }[],
  previousPlan: null as TravelPlan | null,
};

function searchPlan(origin: string, destination: string, departureDate: string) {
  return {
    action: "search" as const,
    searches: [
      {
        product: "FLIGHT" as const,
        query: {
          origin,
          destination,
          departureDate,
          passengers: 1,
          cabinClass: "ECONOMY" as const,
        },
      },
    ],
  };
}

describe("previewLoadingRoute", () => {
  it("Lahore → Shanghai full search", () => {
    const route = previewLoadingRoute("I want to fly from Lahore to Shanghai on September 10", {
      ...OPTS,
    });
    expect(route).toEqual({ origin: "LHE", destination: "PVG" });
  });

  it("Lahore → London", () => {
    const route = previewLoadingRoute("Lahore to London on Sep 15", {
      ...OPTS,
    });
    expect(route).toEqual({ origin: "LHE", destination: "LHR" });
  });

  it("Karachi → Dubai", () => {
    const route = previewLoadingRoute("Karachi to Dubai on Sep 10", {
      ...OPTS,
      defaultOriginIata: "KHI",
      defaultOriginPlace: "Karachi",
    });
    expect(route).toEqual({ origin: "KHI", destination: "DXB" });
  });

  it("LHE→DXB previous + Shanghai instead → LHE→PVG (no stale DXB dest in plan)", () => {
    const prev = searchPlan("LHE", "DXB", "2026-09-10");
    const route = previewLoadingRoute("I want Shanghai instead", {
      ...OPTS,
      previousPlan: prev,
      history: [{ role: "user", content: "Lahore to Dubai" }],
    });
    expect(route).toEqual({ origin: "LHE", destination: "PVG" });
    expect(route?.destination).not.toBe("DXB");
  });

  it("returns null when destination unresolved (clarify)", () => {
    const prev = searchPlan("LHE", "DXB", "2026-09-10");
    const route = previewLoadingRoute("I want to go to China from Lahore", {
      ...OPTS,
      previousPlan: prev,
    });
    expect(route).toBeNull();
  });
});

describe("routeCodesFromTravelPlan", () => {
  it("reads search plan", () => {
    expect(routeCodesFromTravelPlan(searchPlan("KHI", "LHR", "2026-09-15"))).toEqual({
      origin: "KHI",
      destination: "LHR",
    });
  });

  it("reads clarify draft with empty destination as null", () => {
    const plan: TravelPlan = {
      action: "clarify",
      missing: ["destination"],
      ask: "Which city?",
      draft: searchPlan("LHE", "", "2026-09-15"),
    };
    expect(routeCodesFromTravelPlan(plan)).toBeNull();
  });

  it("merged Istanbul correction from DXB", () => {
    const merged = mergeTravelPlan(null, {
      today: OPTS.today,
      defaultOriginIata: OPTS.defaultOriginIata,
      defaultOriginPlace: OPTS.defaultOriginPlace,
      message: "Actually Istanbul instead on September 15.",
      history: [],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(routeCodesFromTravelPlan(merged)).toEqual({
      origin: "LHE",
      destination: "IST",
    });
    expect(firstFlightQuery(merged)?.departureDate).toBe("2026-09-15");
  });
});

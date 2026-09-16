import { describe, expect, it } from "vitest";
import { buildSidebarFilterFacets, defaultSidebarFilters } from "./sidebarFilters";
import { mergeSmartFilterPatch, parseSmartFilter } from "./smartFilterParse";
import type { OfferCard } from "@/lib/consultant/types";

const stubOffer = (id: string, airline: string, code: string): OfferCard => ({
  id,
  type: "flight",
  angle: "recommended",
  title: "Test",
  subtitle: "Test",
  price: "PKR 100,000",
  priceMinor: 10_000_000,
  currency: "PKR",
  marketPrice: null,
  savingsPct: null,
  reasons: [],
  badges: [],
  unitsLeft: 4,
  flight: {
    airline,
    airlineCode: code,
    originCode: "LHE",
    destinationCode: "DXB",
    originCity: "Lahore",
    destinationCity: "Dubai",
    departTimeLocal: "08:30",
    arriveTimeLocal: "11:00",
    durationMinutes: 180,
    stops: 0,
    cabin: "economy",
    baggageKg: 23,
    refundable: false,
  },
});

describe("smartFilterParse", () => {
  it("parses nonstop and airline from natural language", () => {
    const offers = [
      stubOffer("a", "Etihad", "EY"),
      stubOffer("b", "Lufthansa", "LH"),
    ];
    const facets = buildSidebarFilterFacets(offers, [])!;
    const filters = defaultSidebarFilters(facets);
    const result = parseSmartFilter("Nonstop Etihad morning flights", facets, filters);
    expect(result.patch?.stopsNonstop).toBe(true);
    expect(result.patch?.airlines).toEqual(["EY"]);
    expect(result.needsAva).toBe(false);
  });

  it("merges patch into existing filters", () => {
    const offers = [stubOffer("a", "Etihad", "EY")];
    const facets = buildSidebarFilterFacets(offers, [])!;
    const filters = defaultSidebarFilters(facets);
    const result = parseSmartFilter("Economy only", facets, filters);
    const merged = mergeSmartFilterPatch(filters, result.patch!);
    expect(merged.cabins).toEqual(["economy"]);
  });
});

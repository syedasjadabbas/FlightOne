import { describe, expect, it } from "vitest";
import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import type { FilterPill } from "@/lib/ask-ai/types";
import {
  applySidebarFiltersToItineraries,
  applySidebarFiltersToOffers,
  buildSidebarFilterFacets,
  defaultSidebarFilters,
  seedSidebarFiltersFromPills,
} from "./sidebarFilters";

const stubOffer = (id: string, stops: number, depart: string, duration: number): OfferCard => ({
  id,
  type: "flight",
  angle: "recommended",
  title: `${id} flight`,
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
    airline: "Test Air",
    airlineCode: "TA",
    originCode: "LHE",
    destinationCode: "LHR",
    originCity: "Lahore",
    destinationCity: "London",
    departTimeLocal: depart,
    arriveTimeLocal: "18:00",
    durationMinutes: duration,
    stops,
    cabin: "economy",
    baggageKg: 23,
    refundable: false,
  },
});

const stubItinerary = (stops: number, depart: string): ItinerarySummary => ({
  id: "it-1",
  angle: "best_value",
  score: 90,
  totalPrice: "PKR 869,881",
  totalPriceMinor: 86_988_100,
  currency: "PKR",
  reasons: [],
  hops: ["LHE→LHR", "LHR→SFO"],
  constraintsSatisfied: true,
  construction: "multiple_tickets",
  legs: [
    {
      originCode: "LHE",
      destinationCode: "LHR",
      airline: "Test",
      airlineCode: "TA",
      departTimeLocal: depart,
      arriveTimeLocal: "18:00",
      durationMinutes: 480,
      stops,
    },
    {
      originCode: "LHR",
      destinationCode: "SFO",
      airline: "Test",
      airlineCode: "TA",
      departTimeLocal: "11:00",
      arriveTimeLocal: "14:00",
      durationMinutes: 660,
      stops: 0,
    },
  ],
});

describe("sidebarFilters", () => {
  it("builds facets from offers and itineraries", () => {
    const facets = buildSidebarFilterFacets(
      [stubOffer("a", 0, "08:30", 480), stubOffer("b", 1, "14:00", 520)],
      [stubItinerary(1, "10:00")],
    );
    expect(facets).not.toBeNull();
    expect(facets!.hasNonstop).toBe(true);
    expect(facets!.hasOneStop).toBe(true);
    expect(facets!.legs.length).toBeGreaterThan(0);
  });

  it("filters offers by stops and takeoff window", () => {
    const offers = [
      stubOffer("nonstop", 0, "08:30", 480),
      stubOffer("one-stop", 1, "14:00", 520),
    ];
    const facets = buildSidebarFilterFacets(offers, [])!;
    const state = defaultSidebarFilters(facets);
    state.stopsNonstop = true;
    state.stopsOne = false;
    state.stopsTwoPlus = false;

    const filtered = applySidebarFiltersToOffers(offers, state, facets);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("nonstop");
  });

  it("filters itineraries by duration", () => {
    const itineraries = [stubItinerary(1, "10:00")];
    const facets = buildSidebarFilterFacets([], itineraries)!;
    const state = defaultSidebarFilters(facets);
    state.durationMax = 900;

    expect(applySidebarFiltersToItineraries(itineraries, state, facets)).toHaveLength(0);

    state.durationMax = facets.durationMax;
    expect(applySidebarFiltersToItineraries(itineraries, state, facets)).toHaveLength(1);
  });

  it("does not wipe offers when price facets are 0/0", () => {
    const offers = [stubOffer("a", 1, "08:30", 480)];
    const facets = buildSidebarFilterFacets(offers, [])!;
    // Simulate incomplete price facet data that previously capped at PKR 0.
    facets.priceMin = 0;
    facets.priceMax = 0;
    const state = defaultSidebarFilters(facets);
    state.priceMin = 0;
    state.priceMax = 0;

    expect(applySidebarFiltersToOffers(offers, state, facets)).toHaveLength(1);
  });

  it("does not seed impossible nonstop-only when inventory has stops", () => {
    const offers = [stubOffer("one-stop", 1, "08:30", 480)];
    const facets = buildSidebarFilterFacets(offers, [])!;
    const pills: FilterPill[] = [
      {
        id: "nonstop",
        label: "Nonstop",
        kind: "nonstop",
        active: true,
        source: "nl",
      },
    ];
    const state = seedSidebarFiltersFromPills(facets, pills);
    expect(applySidebarFiltersToOffers(offers, state, facets)).toHaveLength(1);
  });
});

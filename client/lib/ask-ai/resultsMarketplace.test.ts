import { describe, expect, it } from "vitest";
import type { OfferCard } from "@/lib/consultant/types";
import {
  buildDriveDiscoveryCards,
  buildExploreTiles,
  buildRelatedSearches,
  buildStayDiscoveryCards,
  deriveDestinationContext,
  realStayOffers,
} from "@/lib/ask-ai/resultsMarketplace";

function flightOffer(partial: {
  originCity: string;
  destinationCity: string;
  originCode: string;
  destinationCode: string;
}): OfferCard {
  return {
    id: `${partial.originCode}-${partial.destinationCode}`,
    type: "flight",
    angle: "best_value",
    title: "Test",
    subtitle: "",
    price: "PKR 1",
    priceMinor: 100,
    currency: "PKR",
    marketPrice: null,
    savingsPct: null,
    reasons: [],
    badges: [],
    flight: {
      airline: "EK",
      airlineCode: "EK",
      originCode: partial.originCode,
      destinationCode: partial.destinationCode,
      originCity: partial.originCity,
      destinationCity: partial.destinationCity,
      departTimeLocal: "10:00",
      arriveTimeLocal: "12:00",
      durationMinutes: 120,
      stops: 0,
      cabin: "economy",
    },
  };
}

describe("resultsMarketplace", () => {
  it("derives Dubai context and metro-related searches for LHE→DXB", () => {
    const offers = [
      flightOffer({
        originCity: "Lahore",
        destinationCity: "Dubai",
        originCode: "LHE",
        destinationCode: "DXB",
      }),
    ];
    const ctx = deriveDestinationContext(null, offers);
    expect(ctx.city).toBe("Dubai");
    expect(ctx.iata).toBe("DXB");
    expect(ctx.marketing?.id).toBe("dubai");

    const related = buildRelatedSearches(ctx);
    const labels = related.map((r) => r.label);
    expect(labels.some((l) => l.includes("Abu Dhabi") || l.includes("Sharjah"))).toBe(true);
    expect(labels).toContain("Dubai → Lahore");

    const explore = buildExploreTiles(ctx);
    expect(explore[0]?.title).toBe("Dubai");
    expect(explore[0]?.imageUrl).toContain("images.unsplash.com");
    expect(explore.some((t) => t.title === "Abu Dhabi" || t.title === "Sharjah")).toBe(true);
  });

  it("derives Istanbul context without Dubai content", () => {
    const offers = [
      flightOffer({
        originCity: "Lahore",
        destinationCity: "Istanbul",
        originCode: "LHE",
        destinationCode: "IST",
      }),
    ];
    const ctx = deriveDestinationContext(null, offers);
    expect(ctx.city).toBe("Istanbul");
    expect(ctx.marketing?.id).toBe("turkey");

    const explore = buildExploreTiles(ctx);
    expect(explore.some((t) => t.title === "Dubai")).toBe(false);
    expect(explore[0]?.title).toBe("Istanbul");
    // SAW is metro for IST — OK if present; Dubai must not appear in Explore
    expect(explore.every((t) => !/dubai|abu dhabi|sharjah/i.test(t.title))).toBe(true);

    const related = buildRelatedSearches(ctx);
    expect(related.some((r) => r.label.includes("Dubai") && r.label.startsWith("Lahore → Dubai"))).toBe(
      true,
    );
    expect(related.some((r) => r.label === "Istanbul → Lahore")).toBe(true);
  });

  it("only returns real stay offers", () => {
    const offers: OfferCard[] = [
      flightOffer({
        originCity: "Lahore",
        destinationCity: "Dubai",
        originCode: "LHE",
        destinationCode: "DXB",
      }),
      {
        id: "h1",
        type: "hotel",
        angle: "best_value",
        title: "Marina Hotel",
        subtitle: "Dubai · 4★",
        price: "PKR 20,000",
        priceMinor: 2000000,
        currency: "PKR",
        marketPrice: null,
        savingsPct: null,
        reasons: [],
        badges: [],
      },
    ];
    expect(realStayOffers(offers)).toHaveLength(1);
    expect(realStayOffers(offers)[0]?.title).toBe("Marina Hotel");
  });

  it("builds stay and drive discovery prompts for Dubai", () => {
    const ctx = deriveDestinationContext(
      null,
      [
        flightOffer({
          originCity: "Lahore",
          destinationCity: "Dubai",
          originCode: "LHE",
          destinationCode: "DXB",
        }),
      ],
    );
    const stays = buildStayDiscoveryCards(ctx);
    const drives = buildDriveDiscoveryCards(ctx);
    expect(stays.some((c) => c.title.includes("Dubai"))).toBe(true);
    expect(stays[0]?.imageUrl).toContain("images.unsplash.com");
    expect(drives.map((c) => c.category)).toEqual(["Compact", "SUV", "Premium"]);
    expect(drives.every((c) => c.imageUrl.includes("images.unsplash.com"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { priceAll } from "@/lib/pricing/pricing";
import {
  applyCuratedAngles,
  buildRankContext,
  curate,
  inferRankPriority,
  rank,
} from "./recommendation";
import type { FlightOffer } from "@/lib/inventory/types";
import { askAiTemplateReply } from "@/lib/ask-ai/prompt";
import type { OfferCard } from "@/lib/consultant/types";

/**
 * Offer-shaped fixtures matching live Travelport DTO → FlightOffer mapping
 * (supplierSearch.dtoToFlightOffer). By default airlineScore / supplierReliability
 * are omitted — ranking must not invent quality/reliability claims.
 */
function flight(id: string, overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: "Dubai",
    destinationCode: "DXB",
    airline: "FlyDubai",
    cabin: "economy",
    stops: 0,
    durationMinutes: 210,
    departTimeLocal: "09:00",
    refundable: false,
    baggageKg: 20,
    unitsLeft: 4,
    netFare: { amount: 6000000, currency: "PKR" },
    marketPrice: { amount: 6000000, currency: "PKR" },
    tags: ["live", "travelport", "gds"],
    ...overrides,
  };
}

function pricedPool(offers: FlightOffer[]) {
  return priceAll(offers);
}

describe("curate() — Best Overall / Cheapest / Fastest (PRD Module 1/4)", () => {
  it("assigns cheapest, fastest, and best overall on distinct offers", () => {
    const pool = pricedPool([
      flight("cheap-slow", {
        netFare: { amount: 4000000, currency: "PKR" },
        marketPrice: { amount: 4000000, currency: "PKR" },
        durationMinutes: 520,
        stops: 2,
        airline: "Airblue",
      }),
      flight("balanced", {
        netFare: { amount: 5200000, currency: "PKR" },
        marketPrice: { amount: 5200000, currency: "PKR" },
        durationMinutes: 200,
        stops: 0,
        airline: "Emirates",
      }),
      flight("fast-pricey", {
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
        durationMinutes: 150,
        stops: 0,
        airline: "Etihad",
      }),
    ]);

    const top3 = curate(pool, 3);
    expect(top3.map((s) => s.angle).sort()).toEqual(
      ["best_value", "cheapest", "fastest"].sort(),
    );
    expect(top3.find((s) => s.angle === "cheapest")?.priced.offer.id).toBe("cheap-slow");
    expect(top3.find((s) => s.angle === "fastest")?.priced.offer.id).toBe("fast-pricey");
    const ids = new Set(top3.map((s) => s.priced.offer.id));
    expect(ids.size).toBe(3);
  });

  it("returns fewer than three when the pool is thin", () => {
    const pool = pricedPool([
      flight("only-one", {
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
      }),
    ]);
    const top = curate(pool, 3);
    expect(top).toHaveLength(1);
    expect(top[0].angle).toBe("best_value");
  });

  it("prevents duplicate recommendation of the same offer across angles", () => {
    const pool = pricedPool([
      flight("a", {
        netFare: { amount: 4000000, currency: "PKR" },
        marketPrice: { amount: 4000000, currency: "PKR" },
        durationMinutes: 150,
      }),
      flight("b", {
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 300,
      }),
    ]);
    const top = curate(pool, 3);
    const ids = top.map((s) => s.priced.offer.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(top.length).toBeLessThanOrEqual(2);
  });

  it("includes price-based reasoning for cheapest", () => {
    const pool = pricedPool([
      flight("cheap", {
        netFare: { amount: 3000000, currency: "PKR" },
        marketPrice: { amount: 3000000, currency: "PKR" },
        durationMinutes: 500,
        stops: 2,
      }),
      flight("best", {
        netFare: { amount: 4500000, currency: "PKR" },
        marketPrice: { amount: 4500000, currency: "PKR" },
        durationMinutes: 200,
        stops: 0,
      }),
      flight("fast", {
        netFare: { amount: 6000000, currency: "PKR" },
        marketPrice: { amount: 6000000, currency: "PKR" },
        durationMinutes: 160,
        stops: 0,
      }),
    ]);
    const cheap = curate(pool, 3).find((s) => s.angle === "cheapest");
    expect(cheap?.priced.offer.id).toBe("cheap");
    expect(cheap?.reasons[0]).toMatch(/Cheapest option at PKR/i);
  });

  it("includes duration-based reasoning for fastest", () => {
    const pool = pricedPool([
      flight("slow", {
        netFare: { amount: 4000000, currency: "PKR" },
        marketPrice: { amount: 4000000, currency: "PKR" },
        durationMinutes: 500,
      }),
      flight("fast", {
        netFare: { amount: 6500000, currency: "PKR" },
        marketPrice: { amount: 6500000, currency: "PKR" },
        durationMinutes: 160,
      }),
    ]);
    const fast = curate(pool, 3).find((s) => s.angle === "fastest");
    expect(fast?.reasons[0]).toMatch(/Fastest option/i);
    expect(fast?.reasons[0]).toMatch(/2h 40m|160/);
  });

  it("does not fabricate airline-quality claims when scores are missing or flat", () => {
    const missing = pricedPool([
      flight("a"),
      flight("b", {
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
        durationMinutes: 160,
      }),
    ]);
    expect(curate(missing, 3).flatMap((s) => s.reasons).join(" ")).not.toMatch(
      /top-rated|more reliable|higher quality|quality score|reliability/i,
    );

    const flat = pricedPool([
      flight("a", { airlineScore: 80, supplierReliability: 90 }),
      flight("b", {
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
        durationMinutes: 160,
        airlineScore: 80,
        supplierReliability: 90,
      }),
    ]);
    const reasons = curate(flat, 3).flatMap((s) => s.reasons).join(" ");
    expect(reasons).not.toMatch(/top-rated|more reliable|higher quality|quality score|reliability/i);
  });

  it("uses real airline quality when differentiated scores are present", () => {
    const pool = pricedPool([
      flight("low-q", {
        airlineScore: 60,
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 200,
        airline: "Airblue",
      }),
      flight("high-q", {
        airlineScore: 96,
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 200,
        airline: "Emirates",
      }),
    ]);
    const ranked = rank(pool);
    expect(ranked[0].priced.offer.id).toBe("high-q");
    expect(ranked.flatMap((s) => s.reasons).join(" ")).toMatch(/quality score/i);
  });

  it("unknown quality/reliability does not unfairly rank an offer high or low", () => {
    const pool = pricedPool([
      flight("a", {
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 200,
      }),
      flight("b", {
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 200,
        airline: "Emirates",
      }),
    ]);
    const scores = rank(pool).map((s) => s.score);
    expect(scores[0]).toBe(scores[1]);
  });

  it("keeps original offer identity and priced data intact", () => {
    const pool = pricedPool([
      flight("id-keep", {
        netFare: { amount: 4550000, currency: "PKR" },
        marketPrice: { amount: 4550000, currency: "PKR" },
      }),
      flight("other", {
        netFare: { amount: 6000000, currency: "PKR" },
        marketPrice: { amount: 6000000, currency: "PKR" },
        durationMinutes: 160,
      }),
    ]);
    const curated = curate(pool, 3);
    for (const s of curated) {
      const original = pool.find((p) => p.offer.id === s.priced.offer.id);
      expect(original).toBeTruthy();
      expect(s.priced.customerPrice.amount).toBe(original!.customerPrice.amount);
      expect(s.priced.offer).toEqual(original!.offer);
    }
  });
});

describe("preference-aware ranking", () => {
  it("boosts preferred airline when ranking best overall", () => {
    const pool = pricedPool([
      flight("pia", {
        airline: "PIA",
        netFare: { amount: 5050000, currency: "PKR" },
        marketPrice: { amount: 5050000, currency: "PKR" },
        durationMinutes: 220,
      }),
      flight("etihad", {
        airline: "Etihad",
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
        durationMinutes: 210,
      }),
    ]);
    const ranked = rank(pool, { filters: { preferredAirlines: ["EY"] } });
    expect(ranked[0].priced.offer.id).toBe("etihad");
    expect(ranked[0].reasons.some((r) => /preferred airline/i.test(r))).toBe(true);
  });

  it("infers price priority from latest explicit message", () => {
    expect(inferRankPriority("I care more about price")).toBe("price");
    expect(inferRankPriority("I prefer Etihad")).toBeUndefined();
    expect(inferRankPriority("find the fastest option")).toBe("speed");
  });

  it("latest price priority overrides previous speed preference in scoring", () => {
    const pool = pricedPool([
      flight("cheap-slow", {
        netFare: { amount: 3500000, currency: "PKR" },
        marketPrice: { amount: 3500000, currency: "PKR" },
        durationMinutes: 480,
        stops: 1,
      }),
      flight("fast-dear", {
        netFare: { amount: 8000000, currency: "PKR" },
        marketPrice: { amount: 8000000, currency: "PKR" },
        durationMinutes: 160,
        stops: 0,
      }),
    ]);
    const speedFirst = rank(pool, { priority: "speed" })[0].priced.offer.id;
    const priceFirst = rank(pool, { priority: "price" })[0].priced.offer.id;
    expect(speedFirst).toBe("fast-dear");
    expect(priceFirst).toBe("cheap-slow");
  });

  it("respects max layover preference when layover minutes are present", () => {
    const pool = pricedPool([
      flight("long-lay", {
        stops: 1,
        durationMinutes: 400,
        netFare: { amount: 4650000, currency: "PKR" },
        marketPrice: { amount: 4650000, currency: "PKR" },
        segments: [
          {
            carrier: "EK",
            flightNumber: "EK1",
            aircraft: null,
            originCode: "LHE",
            destinationCode: "DXB",
            departureDate: "2026-06-01",
            departTimeLocal: "08:00",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "10:00",
            durationMinutes: 120,
            layoverMinutesAfter: 300,
          },
          {
            carrier: "EK",
            flightNumber: "EK2",
            aircraft: null,
            originCode: "DXB",
            destinationCode: "LHR",
            departureDate: "2026-06-01",
            departTimeLocal: "15:00",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "19:00",
            durationMinutes: 240,
          },
        ],
      }),
      flight("short-lay", {
        stops: 1,
        durationMinutes: 380,
        netFare: { amount: 4700000, currency: "PKR" },
        marketPrice: { amount: 4700000, currency: "PKR" },
        airline: "Qatar Airways",
        segments: [
          {
            carrier: "QR",
            flightNumber: "QR1",
            aircraft: null,
            originCode: "LHE",
            destinationCode: "DOH",
            departureDate: "2026-06-01",
            departTimeLocal: "08:00",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "10:00",
            durationMinutes: 120,
            layoverMinutesAfter: 90,
          },
          {
            carrier: "QR",
            flightNumber: "QR2",
            aircraft: null,
            originCode: "DOH",
            destinationCode: "LHR",
            departureDate: "2026-06-01",
            departTimeLocal: "11:30",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "16:30",
            durationMinutes: 260,
          },
        ],
      }),
    ]);
    const ranked = rank(pool, { filters: { maxLayoverMinutes: 120 } });
    expect(ranked[0].priced.offer.id).toBe("short-lay");
  });
});

describe("practical / hub-stitched alternatives", () => {
  it("surfaces hub-stitched tag in reasons without inventing routes", () => {
    const pool = pricedPool([
      flight("hub", {
        tags: ["live", "travelport", "hub-stitched"],
        stops: 1,
        durationMinutes: 500,
        netFare: { amount: 5500000, currency: "PKR" },
        marketPrice: { amount: 5500000, currency: "PKR" },
      }),
      flight("other", {
        durationMinutes: 200,
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
      }),
    ]);
    const scored = rank(pool);
    const hub = scored.find((s) => s.priced.offer.id === "hub");
    expect(hub?.reasons.some((r) => /Hub-connected/i.test(r))).toBe(true);
  });

  it("template reply explains hub alternative search note", () => {
    const cards: OfferCard[] = [
      {
        id: "hub",
        type: "flight",
        angle: "best_value",
        title: "Lahore → Karachi",
        subtitle: "",
        price: "PKR 55,000",
        priceMinor: 5500000,
        currency: "PKR",
        marketPrice: null,
        savingsPct: null,
        reasons: ["Hub-connected alternative (multi-ticket)"],
        badges: ["Multi-ticket"],
        hubStitched: true,
      },
    ];
    const reply = askAiTemplateReply(
      cards,
      { origin: "Lahore", destination: "Karachi", type: "flight", offTopic: false },
      "en-PK",
      "Lahore",
    );
    expect(reply).toMatch(/live option/i);
    expect(reply).toMatch(/Karachi/);
    expect(reply.toLowerCase()).not.toMatch(/\bfabricat|\bmade up\b/);
  });
});

describe("Module 4 scoring dimensions", () => {
  it("ranks by relative journey duration across the pool", () => {
    const pool = pricedPool([
      flight("long", {
        durationMinutes: 600,
        stops: 1,
        netFare: { amount: 4800000, currency: "PKR" },
        marketPrice: { amount: 4800000, currency: "PKR" },
      }),
      flight("short", {
        durationMinutes: 180,
        stops: 0,
        netFare: { amount: 5200000, currency: "PKR" },
        marketPrice: { amount: 5200000, currency: "PKR" },
      }),
    ]);
    const ranked = rank(pool, { priority: "speed" });
    expect(ranked[0].priced.offer.id).toBe("short");
  });

  it("penalizes tight and long layovers from real segment minutes", () => {
    const pool = pricedPool([
      flight("tight", {
        stops: 1,
        durationMinutes: 360,
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        segments: [
          {
            carrier: "EK",
            flightNumber: "EK1",
            aircraft: null,
            originCode: "LHE",
            destinationCode: "DXB",
            departureDate: "2026-06-01",
            departTimeLocal: "08:00",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "10:00",
            durationMinutes: 120,
            layoverMinutesAfter: 30,
          },
          {
            carrier: "EK",
            flightNumber: "EK2",
            aircraft: null,
            originCode: "DXB",
            destinationCode: "LHR",
            departureDate: "2026-06-01",
            departTimeLocal: "10:30",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "15:00",
            durationMinutes: 240,
          },
        ],
      }),
      flight("comfy", {
        stops: 1,
        durationMinutes: 380,
        airline: "Qatar Airways",
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        segments: [
          {
            carrier: "QR",
            flightNumber: "QR1",
            aircraft: null,
            originCode: "LHE",
            destinationCode: "DOH",
            departureDate: "2026-06-01",
            departTimeLocal: "08:00",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "10:00",
            durationMinutes: 120,
            layoverMinutesAfter: 90,
          },
          {
            carrier: "QR",
            flightNumber: "QR2",
            aircraft: null,
            originCode: "DOH",
            destinationCode: "LHR",
            departureDate: "2026-06-01",
            departTimeLocal: "11:30",
            arrivalDate: "2026-06-01",
            arriveTimeLocal: "16:30",
            durationMinutes: 260,
          },
        ],
      }),
    ]);
    const ranked = rank(pool);
    expect(ranked[0].priced.offer.id).toBe("comfy");
    expect(ranked.find((s) => s.priced.offer.id === "tight")?.reasons.join(" ")).toMatch(
      /Tight connection/i,
    );
  });

  it("soft-boosts loyalty membership airline without inventing miles", () => {
    const pool = pricedPool([
      flight("pia", {
        airline: "PIA",
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
        durationMinutes: 210,
      }),
      flight("etihad", {
        airline: "Etihad",
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
        durationMinutes: 210,
      }),
    ]);
    const ranked = rank(pool, { loyaltyAirlineCodes: ["EY"] });
    expect(ranked[0].priced.offer.id).toBe("etihad");
    expect(ranked[0].reasons.some((r) => /loyalty membership/i.test(r))).toBe(true);
    expect(ranked[0].reasons.join(" ").toLowerCase()).not.toMatch(/miles|status perk|\+\d+k/);
  });

  it("soft-scores refundable when supplier marks refundable true", () => {
    const pool = pricedPool([
      flight("flex", {
        refundable: true,
        netFare: { amount: 5200000, currency: "PKR" },
        marketPrice: { amount: 5200000, currency: "PKR" },
      }),
      flight("locked", {
        refundable: false,
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 220,
      }),
    ]);
    const flex = rank(pool).find((s) => s.priced.offer.id === "flex");
    expect(flex?.reasons.some((r) => /Refundable fare/i.test(r))).toBe(true);
  });

  it("mentions supplier reliability only when pool values differ", () => {
    const flat = pricedPool([
      flight("a", { airlineScore: 80, supplierReliability: 90 }),
      flight("b", {
        airlineScore: 80,
        supplierReliability: 90,
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
      }),
    ]);
    expect(rank(flat).flatMap((s) => s.reasons).join(" ")).not.toMatch(/reliability/i);

    const missing = pricedPool([
      flight("a"),
      flight("b", {
        netFare: { amount: 7000000, currency: "PKR" },
        marketPrice: { amount: 7000000, currency: "PKR" },
      }),
    ]);
    expect(rank(missing).flatMap((s) => s.reasons).join(" ")).not.toMatch(/reliability/i);

    const varied = pricedPool([
      flight("low", { airlineScore: 70, supplierReliability: 70 }),
      flight("high", {
        airlineScore: 95,
        supplierReliability: 98,
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
      }),
    ]);
    const reasons = rank(varied).flatMap((s) => s.reasons).join(" ");
    expect(reasons).toMatch(/quality score|reliability/i);
    expect(rank(varied)[0].priced.offer.id).toBe("high");
  });

  it("penalizes red-eye departures when avoidRedEye is set", () => {
    const pool = pricedPool([
      flight("redeye", {
        departTimeLocal: "02:30",
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 210,
      }),
      flight("day", {
        departTimeLocal: "10:00",
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 210,
      }),
    ]);
    const ranked = rank(pool, { avoidRedEye: true });
    expect(ranked[0].priced.offer.id).toBe("day");
    expect(ranked.find((s) => s.priced.offer.id === "redeye")?.reasons.join(" ")).toMatch(
      /red-eye/i,
    );
  });

  it("penalizes late arrivals when avoidLateArrival and arriveTimeLocal known", () => {
    const pool = pricedPool([
      flight("late", {
        arriveTimeLocal: "23:40",
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 210,
      }),
      flight("ok", {
        arriveTimeLocal: "18:00",
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 210,
      }),
    ]);
    const ranked = rank(pool, { avoidLateArrival: true });
    expect(ranked[0].priced.offer.id).toBe("ok");
  });

  it("boosts hub-stitched practical alternatives when no nonstop exists", () => {
    const pool = pricedPool([
      flight("hub", {
        tags: ["live", "travelport", "hub-stitched"],
        stops: 1,
        durationMinutes: 520,
        netFare: { amount: 5500000, currency: "PKR" },
        marketPrice: { amount: 5500000, currency: "PKR" },
      }),
      flight("other-stop", {
        stops: 1,
        durationMinutes: 500,
        netFare: { amount: 5600000, currency: "PKR" },
        marketPrice: { amount: 5600000, currency: "PKR" },
      }),
    ]);
    const ranked = rank(pool);
    expect(ranked[0].priced.offer.id).toBe("hub");
    expect(ranked[0].reasons.some((r) => /Hub-connected/i.test(r))).toBe(true);
  });

  it("buildRankContext: chat price priority wins; profile loyalty still soft-applies", () => {
    const ctx = buildRankContext(
      "I care more about price",
      { preferredAirlines: ["PK"] },
      { loyaltyAirlineCodes: ["EY"] },
    );
    expect(ctx.priority).toBe("price");
    expect(ctx.loyaltyAirlineCodes).toEqual(["EY"]);
    expect(ctx.filters?.preferredAirlines).toEqual(["PK"]);
  });

  it("buildRankContext: chat avoid red-eye overrides missing profile", () => {
    const ctx = buildRankContext("please avoid red-eye flights", undefined, null);
    expect(ctx.avoidRedEye).toBe(true);
  });

  it("explicit chat preferred airline outweighs profile loyalty soft boost", () => {
    const pool = pricedPool([
      flight("pia", {
        airline: "PIA",
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
        durationMinutes: 210,
      }),
      flight("etihad", {
        airline: "Etihad",
        netFare: { amount: 5100000, currency: "PKR" },
        marketPrice: { amount: 5100000, currency: "PKR" },
        durationMinutes: 210,
      }),
    ]);
    // Chat says prefer PIA; profile loyalty is EY — preferred filter wins hard.
    const ranked = rank(pool, {
      filters: { preferredAirlines: ["PK"] },
      loyaltyAirlineCodes: ["EY"],
      priority: inferRankPriority("prefer PIA"),
    });
    expect(ranked[0].priced.offer.id).toBe("pia");
  });
});

describe("applyCuratedAngles", () => {
  it("stamps curated angles onto the ranked SERP without inventing offers", () => {
    const pool = pricedPool([
      flight("a", {
        netFare: { amount: 4000000, currency: "PKR" },
        marketPrice: { amount: 4000000, currency: "PKR" },
        durationMinutes: 500,
        stops: 2,
      }),
      flight("b", {
        netFare: { amount: 6000000, currency: "PKR" },
        marketPrice: { amount: 6000000, currency: "PKR" },
        durationMinutes: 160,
        stops: 0,
      }),
      flight("c", {
        netFare: { amount: 5000000, currency: "PKR" },
        marketPrice: { amount: 5000000, currency: "PKR" },
        durationMinutes: 220,
        stops: 0,
      }),
    ]);
    const ranked = rank(pool);
    const curated = curate(pool, 3);
    const stamped = applyCuratedAngles(ranked, curated);
    expect(stamped).toHaveLength(ranked.length);
    expect(curated.map((s) => s.angle).sort()).toEqual(
      ["best_value", "cheapest", "fastest"].sort(),
    );
    expect(stamped.find((s) => s.angle === "cheapest")?.priced.offer.id).toBe("a");
    expect(stamped.find((s) => s.angle === "fastest")?.priced.offer.id).toBe("b");
  });

  it("curates three angles from a post-filter pool of distinct offers", () => {
    // Regression: curation must run on the integrity-filtered pool the rail shows,
    // not on pre-filter alts that later get dropped (leaving only best_value).
    const pool = pricedPool([
      flight("keep-cheap", {
        netFare: { amount: 4000000, currency: "PKR" },
        marketPrice: { amount: 4000000, currency: "PKR" },
        durationMinutes: 480,
        stops: 1,
      }),
      flight("keep-best", {
        netFare: { amount: 5200000, currency: "PKR" },
        marketPrice: { amount: 5200000, currency: "PKR" },
        durationMinutes: 210,
        stops: 0,
      }),
      flight("keep-fast", {
        netFare: { amount: 6800000, currency: "PKR" },
        marketPrice: { amount: 6800000, currency: "PKR" },
        durationMinutes: 155,
        stops: 0,
      }),
    ]);
    const curated = curate(pool, 3);
    expect(curated.map((s) => s.angle).sort()).toEqual(
      ["best_value", "cheapest", "fastest"].sort(),
    );
    expect(new Set(curated.map((s) => s.priced.offer.id)).size).toBe(3);
  });
});

describe("decision-oriented Ava template", () => {
  it("structures Best overall / Cheapest / Fastest from curated cards", () => {
    const curated: OfferCard[] = [
      {
        id: "best",
        type: "flight",
        angle: "best_value",
        title: "Lahore → Dubai",
        subtitle: "",
        price: "PKR 52,000",
        priceMinor: 5200000,
        currency: "PKR",
        marketPrice: null,
        savingsPct: null,
        reasons: ["Best overall because it offers a shorter journey for a small price difference"],
        badges: [],
      },
      {
        id: "cheap",
        type: "flight",
        angle: "cheapest",
        title: "Lahore → Dubai",
        subtitle: "",
        price: "PKR 40,000",
        priceMinor: 4000000,
        currency: "PKR",
        marketPrice: null,
        savingsPct: null,
        reasons: ["Cheapest option at PKR 40,000"],
        badges: [],
      },
      {
        id: "fast",
        type: "flight",
        angle: "fastest",
        title: "Lahore → Dubai",
        subtitle: "",
        price: "PKR 70,000",
        priceMinor: 7000000,
        currency: "PKR",
        marketPrice: null,
        savingsPct: null,
        reasons: ["Fastest option with the shortest total journey (2h 30m)"],
        badges: [],
      },
    ];
    const reply = askAiTemplateReply(
      curated,
      { origin: "Lahore", destination: "Dubai", type: "flight", offTopic: false },
      "en-PK",
      "Lahore",
    );
    expect(reply).toMatch(/live option/i);
    expect(reply).toMatch(/Dubai/);
    expect(reply).toMatch(/results panel/i);
  });
});

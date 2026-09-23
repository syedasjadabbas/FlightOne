import { describe, expect, it } from "vitest";
import { offerCardFromItinerary } from "./offerFromItinerary";
import type { ItinerarySummary } from "@/lib/consultant/types";

const leg = (over: Partial<NonNullable<ItinerarySummary["legs"]>[number]> = {}) => ({
  originCode: "SKT",
  destinationCode: "MAN",
  airline: "Emirates",
  airlineCode: "EK",
  departTimeLocal: "02:20",
  arriveTimeLocal: "12:14",
  durationMinutes: 600,
  stops: 1,
  departureDate: "2026-11-19",
  cabin: "economy" as const,
  baggageKg: 30,
  priceMinor: 1_000_000,
  currency: "PKR",
  offerId: "DEMO-A-01",
  supplierOfferSnapshotId: "snap_a",
  ...over,
});

const itinerary = (over: Partial<ItinerarySummary> = {}): ItinerarySummary =>
  ({
    id: "itin-1",
    angle: "cheapest",
    score: 90,
    totalPrice: "PKR 408,750",
    totalPriceMinor: 40_875_000,
    currency: "PKR",
    reasons: ["Cheapest complete trip"],
    hops: ["SKT→MAN", "MAN→DUB", "DUB→SKT"],
    constraintsSatisfied: true,
    construction: "multiple_tickets",
    legs: [
      leg(),
      leg({ originCode: "MAN", destinationCode: "DUB", offerId: "DEMO-B-01", supplierOfferSnapshotId: "snap_b" }),
      leg({ originCode: "DUB", destinationCode: "SKT", offerId: "DEMO-C-01", supplierOfferSnapshotId: "snap_c" }),
    ],
    ...over,
  }) as ItinerarySummary;

describe("offerCardFromItinerary", () => {
  it("anchors the quote to the first leg's snapshot", () => {
    const offer = offerCardFromItinerary(itinerary());
    expect(offer?.supplierOfferSnapshotId).toBe("snap_a");
    expect(offer?.id).toBe("DEMO-A-01");
  });

  it("prices the whole trip, not just the anchor leg", () => {
    const offer = offerCardFromItinerary(itinerary());
    // Quoting the first leg's fare would undercharge by two legs.
    expect(offer?.priceMinor).toBe(40_875_000);
    expect(offer?.price).toBe("PKR 408,750");
  });

  it("spans origin of the first leg to destination of the last", () => {
    const offer = offerCardFromItinerary(itinerary());
    expect(offer?.flight?.originCode).toBe("SKT");
    expect(offer?.flight?.destinationCode).toBe("SKT");
    expect(offer?.flight?.durationMinutes).toBe(1800);
  });

  it("carries every leg so checkout can show the full journey", () => {
    const offer = offerCardFromItinerary(itinerary());
    const legs = (offer?.metadata as { tripLegs?: unknown[] })?.tripLegs;
    expect(legs).toHaveLength(3);
  });

  it("returns null when the first leg has no supplier snapshot", () => {
    // Hub-stitched and web-meta trips land here — nothing to quote against.
    const noSnap = itinerary({
      legs: [leg({ supplierOfferSnapshotId: undefined })],
    });
    expect(offerCardFromItinerary(noSnap)).toBeNull();
  });

  it("returns null for an itinerary with no legs at all", () => {
    expect(offerCardFromItinerary(itinerary({ legs: undefined }))).toBeNull();
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("./searchFlightsPreferred", () => ({
  searchFlightsPreferredThenOpen: vi.fn(),
}));

import { searchFlightsPreferredThenOpen } from "./searchFlightsPreferred";
import { searchFlightsWithRouting } from "./searchFlightsRouted";
import type { FlightOffer } from "./types";

const searchMock = vi.mocked(searchFlightsPreferredThenOpen);

function flight(
  id: string,
  origin: string,
  dest: string,
  opts?: Partial<FlightOffer>,
): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "Travelport",
    origin,
    originCode: origin,
    destination: dest,
    destinationCode: dest,
    airline: "Etihad",
    cabin: "economy",
    stops: 1,
    durationMinutes: 825,
    departTimeLocal: "04:15",
    arriveTimeLocal: "12:00",
    departureDate: "2026-12-20",
    refundable: false,
    baggageKg: 20,
    airlineScore: 80,
    supplierReliability: 90,
    unitsLeft: 4,
    netFare: { amount: 20000000, currency: "PKR" },
    marketPrice: { amount: 22000000, currency: "PKR" },
    tags: ["live"],
    segments: [
      {
        carrier: "EY",
        flightNumber: "EY1",
        originCode: origin,
        destinationCode: dest,
        departureDate: "2026-12-20",
        departTimeLocal: "04:15",
        arrivalDate: "2026-12-20",
        arriveTimeLocal: "12:00",
        durationMinutes: 825,
      },
    ],
    ...opts,
  };
}

describe("searchFlightsWithRouting", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns primary results when exact city pair has inventory", async () => {
    searchMock.mockResolvedValueOnce([flight("a", "LHE", "IAD")]);
    const out = await searchFlightsWithRouting({
      origin: "LHE",
      destination: "IAD",
      departureDate: "2026-12-20",
    });
    expect(out).toHaveLength(1);
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to nearby WAS gateways when Norfolk (ORF) is empty", async () => {
    searchMock.mockImplementation(async (q) => {
      if (q.destination === "ORF") return [];
      if (q.destination === "IAD") return [flight("iad", "LHE", "IAD")];
      if (q.destination === "DCA") return [flight("dca", "LHE", "DCA")];
      if (q.destination === "BWI") return [flight("bwi", "LHE", "BWI")];
      return [];
    });

    const out = await searchFlightsWithRouting({
      origin: "LHE",
      destination: "ORF",
      departureDate: "2026-12-20",
    });

    expect(out && out.length).toBeGreaterThan(0);
    expect(out?.some((o) => isFlightDest(o, "IAD"))).toBe(true);
    expect(out?.[0].tags).toContain("nearby-airport");
    expect(out?.[0].tags).toContain("requested-ORF");
  });
});

function isFlightDest(o: { type: string; destinationCode?: string }, code: string) {
  return o.type === "flight" && (o as FlightOffer).destinationCode === code;
}

import { describe, expect, it } from "vitest";
import {
  collapseMetroLookalikeFlights,
  lookalikeKey,
  tagNearbyAirportFlights,
} from "./collapseMetroLookalikes";
import type { FlightOffer } from "@/lib/inventory/types";

function flight(
  id: string,
  dest: string,
  opts?: Partial<FlightOffer>,
): FlightOffer {
  return {
    id,
    type: "flight",
    supplier: "Travelport",
    origin: "Lahore",
    originCode: "LHE",
    destination: dest === "DMK" ? "DMK" : "Bangkok",
    destinationCode: dest,
    airline: "UL",
    cabin: "economy",
    stops: 1,
    durationMinutes: 1405,
    departTimeLocal: "06:50",
    arriveTimeLocal: "06:15",
    refundable: false,
    baggageKg: 20,
    airlineScore: 80,
    supplierReliability: 90,
    unitsLeft: 4,
    netFare: { amount: 12643500, currency: "PKR" },
    marketPrice: { amount: 13000000, currency: "PKR" },
    tags: ["live"],
    ...opts,
  };
}

describe("collapseMetroLookalikeFlights", () => {
  it("keeps BKK over DMK when price/time/airline match", () => {
    const out = collapseMetroLookalikeFlights(
      [flight("dmk", "DMK", { tags: ["live", "nearby-airport"] }), flight("bkk", "BKK")],
      "BKK",
      "LHE",
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("bkk");
  });

  it("keeps both when prices differ", () => {
    const out = collapseMetroLookalikeFlights(
      [
        flight("bkk", "BKK"),
        flight("dmk", "DMK", {
          netFare: { amount: 10000000, currency: "PKR" },
          tags: ["live", "nearby-airport"],
        }),
      ],
      "BKK",
      "LHE",
    );
    expect(out).toHaveLength(2);
  });

  it("shares lookalike key across metro airports", () => {
    expect(lookalikeKey(flight("a", "BKK"))).toBe(lookalikeKey(flight("b", "DMK")));
  });
});

describe("tagNearbyAirportFlights", () => {
  it("tags DMK when primary dest is BKK", () => {
    const [tagged] = tagNearbyAirportFlights([flight("dmk", "DMK")], "LHE", "BKK");
    expect(tagged.tags).toContain("nearby-airport");
  });
});

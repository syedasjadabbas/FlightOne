import { describe, expect, it } from "vitest";
import { priceOffer } from "@/lib/pricing/pricing";
import type { FlightOffer } from "@/lib/inventory/types";
import { buildItineraries } from "./builder";
import { filterValidItineraries } from "./constraints";
import { curateItineraries } from "@/lib/recommendation/itineraryRecommendation";
import type { PlanningTravelPlan } from "@/lib/travel-planner/types";

function flight(partial: Partial<FlightOffer> & Pick<FlightOffer, "id" | "originCode" | "destinationCode" | "departureDate">): FlightOffer {
  return {
    type: "flight",
    supplier: "test",
    origin: partial.originCode,
    destination: partial.destinationCode,
    airline: "Test Air",
    cabin: "economy",
    stops: 0,
    durationMinutes: 200,
    departTimeLocal: "10:00",
    arriveTimeLocal: "14:00",
    baggageKg: 20,
    airlineScore: 80,
    supplierReliability: 90,
    unitsLeft: 4,
    netFare: { amount: 50_000_00, currency: "PKR" },
    marketPrice: { amount: 60_000_00, currency: "PKR" },
    refundable: false,
    tags: ["live", "travelport"],
    segments: [
      {
        carrier: "XX",
        flightNumber: "XX1",
        originCode: partial.originCode,
        destinationCode: partial.destinationCode,
        departureDate: partial.departureDate!,
        departTimeLocal: "10:00",
        arrivalDate: partial.departureDate!,
        arriveTimeLocal: "14:00",
        durationMinutes: 200,
      },
    ],
    ...partial,
  };
}

function priced(o: FlightOffer) {
  return priceOffer(o);
}

const plan: PlanningTravelPlan = {
  tripType: "multi_city",
  origins: ["LHE"],
  passengers: 1,
  legs: [
    { origin: "LHE", destination: "LHR", date: "2026-09-01", purpose: "outbound" },
    {
      origin: "LHR",
      destination: "SFO",
      date: "2026-09-03",
      purpose: "stopover",
      stay: { nights: 2, exact: true },
    },
    { origin: "SFO", destination: "MCO", date: "2026-09-18", purpose: "main_destination" },
    { origin: "MCO", destination: "LHE", date: "2026-09-20", purpose: "return" },
  ],
  hardConstraints: [
    {
      type: "stay_nights",
      value: { city: "LHR", nights: 2, afterLegIndex: 0 },
      hard: true,
      description: "Stay 2 night(s) in/near LHR",
    },
  ],
  softPreferences: [],
  optimizationGoal: "best_value",
};

describe("itinerary builder + constraints", () => {
  it("builds a continuous multi-hop itinerary and gates stay nights", () => {
    const buckets = [
      [
        priced(
          flight({
            id: "a1",
            originCode: "LHE",
            destinationCode: "LHR",
            departureDate: "2026-09-01",
            segments: [
              {
                carrier: "XX",
                flightNumber: "XX100",
                originCode: "LHE",
                destinationCode: "LHR",
                departureDate: "2026-09-01",
                departTimeLocal: "08:00",
                arrivalDate: "2026-09-01",
                arriveTimeLocal: "14:00",
                durationMinutes: 360,
              },
            ],
          }),
        ),
      ],
      [
        priced(
          flight({
            id: "b1",
            originCode: "LHR",
            destinationCode: "SFO",
            departureDate: "2026-09-03",
            netFare: { amount: 80_000_00, currency: "PKR" },
            marketPrice: { amount: 90_000_00, currency: "PKR" },
            segments: [
              {
                carrier: "XX",
                flightNumber: "XX200",
                originCode: "LHR",
                destinationCode: "SFO",
                departureDate: "2026-09-03",
                departTimeLocal: "11:00",
                arrivalDate: "2026-09-03",
                arriveTimeLocal: "14:00",
                durationMinutes: 600,
              },
            ],
          }),
        ),
      ],
      [
        priced(
          flight({
            id: "c1",
            originCode: "SFO",
            destinationCode: "MCO",
            departureDate: "2026-09-18",
            netFare: { amount: 20_000_00, currency: "PKR" },
            marketPrice: { amount: 25_000_00, currency: "PKR" },
          }),
        ),
      ],
      [
        priced(
          flight({
            id: "d1",
            originCode: "MCO",
            destinationCode: "LHE",
            departureDate: "2026-09-20",
            netFare: { amount: 70_000_00, currency: "PKR" },
            marketPrice: { amount: 80_000_00, currency: "PKR" },
          }),
        ),
      ],
    ];

    const built = buildItineraries(buckets, plan);
    expect(built.length).toBeGreaterThan(0);
    const valid = filterValidItineraries(built, plan);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid[0].constraints.satisfied).toBe(true);
    expect(valid[0].offers.length).toBe(4);
    // Component sum — no double markup
    const sum = valid[0].offers.reduce((s, p) => s + p.customerPrice.amount, 0);
    expect(valid[0].totalCustomerPrice.amount).toBe(sum);

    const curated = curateItineraries(valid, plan, 3);
    expect(curated[0].angle).toBe("best_value");
    expect(curated[0].reasons.some((r) => /validated|constraints|Lowest/i.test(r))).toBe(true);
  });

  it("discards stay-night violations", () => {
    const buckets = [
      [
        priced(
          flight({
            id: "a1",
            originCode: "LHE",
            destinationCode: "LHR",
            departureDate: "2026-09-01",
            segments: [
              {
                carrier: "XX",
                flightNumber: "XX100",
                originCode: "LHE",
                destinationCode: "LHR",
                departureDate: "2026-09-01",
                departTimeLocal: "08:00",
                arrivalDate: "2026-09-01",
                arriveTimeLocal: "14:00",
                durationMinutes: 360,
              },
            ],
          }),
        ),
      ],
      [
        priced(
          flight({
            id: "b1",
            originCode: "LHR",
            destinationCode: "SFO",
            // Only 1 night after arrive Sep 1
            departureDate: "2026-09-02",
            segments: [
              {
                carrier: "XX",
                flightNumber: "XX200",
                originCode: "LHR",
                destinationCode: "SFO",
                departureDate: "2026-09-02",
                departTimeLocal: "11:00",
                arrivalDate: "2026-09-02",
                arriveTimeLocal: "14:00",
                durationMinutes: 600,
              },
            ],
          }),
        ),
      ],
    ];
    const shortPlan: PlanningTravelPlan = {
      ...plan,
      legs: plan.legs.slice(0, 2),
    };
    const built = buildItineraries(buckets, shortPlan);
    const valid = filterValidItineraries(built, shortPlan);
    expect(valid.length).toBe(0);
  });

  it("allows open-jaw landside gap (arrive SFO, return from MCO)", () => {
    const ojPlan: PlanningTravelPlan = {
      tripType: "open_jaw",
      origins: ["ISB"],
      passengers: 1,
      legs: [
        {
          origin: "ISB",
          destination: "SFO",
          date: "2026-09-01",
          purpose: "main_destination",
        },
        { origin: "MCO", destination: "LHE", date: "2026-09-20", purpose: "return" },
      ],
      hardConstraints: [
        {
          type: "return_depart_city",
          value: { iata: "MCO" },
          hard: true,
          description: "Return departs from MCO",
        },
        {
          type: "visit_destination",
          value: { iata: "SFO" },
          hard: true,
          description: "Include destination SFO",
        },
      ],
      softPreferences: [],
      optimizationGoal: "best_value",
    };
    const buckets = [
      [
        priced(
          flight({
            id: "out",
            originCode: "ISB",
            destinationCode: "SFO",
            departureDate: "2026-09-01",
            segments: [
              {
                carrier: "EY",
                flightNumber: "EY1",
                originCode: "ISB",
                destinationCode: "SFO",
                departureDate: "2026-09-01",
                departTimeLocal: "04:50",
                arrivalDate: "2026-09-01",
                arriveTimeLocal: "20:56",
                durationMinutes: 900,
              },
            ],
          }),
        ),
      ],
      [
        priced(
          flight({
            id: "ret",
            originCode: "MCO",
            destinationCode: "LHE",
            departureDate: "2026-09-20",
            netFare: { amount: 70_000_00, currency: "PKR" },
            marketPrice: { amount: 80_000_00, currency: "PKR" },
          }),
        ),
      ],
    ];
    const built = buildItineraries(buckets, ojPlan);
    expect(built.length).toBeGreaterThan(0);
    const valid = filterValidItineraries(built, ojPlan);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid[0].offers).toHaveLength(2);
  });
});

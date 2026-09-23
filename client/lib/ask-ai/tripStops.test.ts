import { describe, expect, it } from "vitest";
import { tripRouteLabel, tripStops } from "./tripStops";

const leg = (originCode: string, destinationCode: string) =>
  ({ originCode, destinationCode }) as never;

describe("tripStops", () => {
  it("lists each airport once, not once per leg it touches", () => {
    const stops = tripStops({
      hops: ["LHE→LHR", "LHR→CDG", "CDG→LHE"],
      legs: [leg("LHE", "LHR"), leg("LHR", "CDG"), leg("CDG", "LHE")],
    });
    expect(stops.map((s) => s.code)).toEqual(["LHE", "LHR", "CDG", "LHE"]);
    expect(stops.some((s) => s.groundGapBefore)).toBe(false);
  });

  it("marks an open-jaw ground gap instead of inventing a flight", () => {
    // Fly into London, home from Manchester — there is no LHR→MAN flight.
    const stops = tripStops({
      hops: ["LHE→LHR", "MAN→LHE"],
      legs: [leg("LHE", "LHR"), leg("MAN", "LHE")],
    });
    expect(stops.map((s) => s.code)).toEqual(["LHE", "LHR", "MAN", "LHE"]);
    expect(stops[2].groundGapBefore).toBe(true);
    expect(tripRouteLabel({ hops: [], legs: [leg("LHE", "LHR"), leg("MAN", "LHE")] })).toBe(
      "LHE → LHR / MAN → LHE",
    );
  });

  it("un-pairs the hop strings when there are no legs", () => {
    expect(tripRouteLabel({ hops: ["LHE→LHR", "LHR→CDG", "CDG→LHE"] })).toBe(
      "LHE → LHR → CDG → LHE",
    );
  });

  it("returns nothing for an empty itinerary rather than a placeholder", () => {
    expect(tripStops({ hops: [] })).toEqual([]);
  });
});

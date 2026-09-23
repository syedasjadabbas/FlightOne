import type { ItinerarySummary } from "@/lib/consultant/types";

export type TripStop = {
  code: string;
  /** No flight into this stop from the previous one — an open-jaw ground gap. */
  groundGapBefore: boolean;
};

/**
 * Ordered airports a multi-city trip passes through: LHE, LHR, CDG, LHE.
 *
 * `itinerary.hops` is per-leg PAIRS ("LHE→LHR", "LHR→CDG"). Joining those
 * directly printed every connecting airport twice ("LHE→LHR → LHR→CDG"), so
 * stops are read from the legs and the pair-form hops are only a fallback.
 */
export function tripStops(itinerary: Pick<ItinerarySummary, "hops" | "legs">): TripStop[] {
  const pairs: [string, string][] =
    itinerary.legs && itinerary.legs.length > 0
      ? itinerary.legs.map((l) => [l.originCode, l.destinationCode])
      : itinerary.hops
          .map((hop) => hop.split(/\s*[→>-]\s*/).filter(Boolean))
          .filter((p): p is [string, string] => p.length === 2);

  const stops: TripStop[] = [];
  for (const [from, to] of pairs) {
    const prev = stops[stops.length - 1];
    if (!prev) {
      stops.push({ code: from, groundGapBefore: false });
    } else if (prev.code !== from) {
      // Open jaw: land at LHR, fly out of MAN. Show both, but never imply a
      // LHR→MAN flight that isn't in the itinerary.
      stops.push({ code: from, groundGapBefore: true });
    }
    stops.push({ code: to, groundGapBefore: false });
  }
  return stops;
}

/** "LHE → LHR → CDG → LHE"; an open-jaw gap renders as " / ". */
export function tripRouteLabel(itinerary: Pick<ItinerarySummary, "hops" | "legs">): string {
  return tripStops(itinerary)
    .map((s, i) => (i === 0 ? s.code : `${s.groundGapBefore ? " / " : " → "}${s.code}`))
    .join("");
}

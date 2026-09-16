import { isFlight, type FlightOffer } from "@/lib/inventory/types";
import type { PricedOffer } from "@/lib/pricing/pricing";
import { sameMetro } from "@/lib/comps/altAirports";
import type { PlanningTravelPlan } from "@/lib/travel-planner/types";
import type { ItineraryCandidate } from "./types";
import { calendarNightsBetween } from "./stay";

function flightOffers(c: ItineraryCandidate): FlightOffer[] {
  return c.offers
    .map((p) => (isFlight(p.offer) ? p.offer : null))
    .filter((f): f is FlightOffer => f != null);
}

function arriveDate(o: FlightOffer): string {
  const segs = o.segments;
  if (segs?.length) {
    const last = segs[segs.length - 1];
    if (last.arrivalDate) return last.arrivalDate;
  }
  return o.departureDate || "";
}

function departDate(o: FlightOffer): string {
  if (o.segments?.[0]?.departureDate) return o.segments[0].departureDate;
  return o.departureDate || "";
}

export interface ConstraintResult {
  satisfied: boolean;
  violations: string[];
}

/**
 * Hard constraints are gates — violations discard the candidate.
 * Soft preferences are not evaluated here (scorer owns them).
 */
export function validateHardConstraints(
  candidate: ItineraryCandidate,
  plan: PlanningTravelPlan,
): ConstraintResult {
  const violations: string[] = [];
  const flights = flightOffers(candidate);
  if (!flights.length) {
    return { satisfied: false, violations: ["No flight components in itinerary"] };
  }

  // Chronological continuity always; airport continuity except open-jaw landside gap
  // between the final outbound arrival and the return origin (last hop).
  const allowOpenJawGap = plan.tripType === "open_jaw";
  for (let i = 1; i < flights.length; i++) {
    const prev = flights[i - 1];
    const next = flights[i];
    const isReturnGap = allowOpenJawGap && i === flights.length - 1;
    if (
      !isReturnGap &&
      !sameMetro(prev.destinationCode, next.originCode) &&
      prev.destinationCode !== next.originCode
    ) {
      violations.push(
        `Connection break: ${prev.destinationCode} → ${next.originCode}`,
      );
    }
    const a = arriveDate(prev);
    const d = departDate(next);
    if (a && d && d < a) {
      violations.push(`Chronology: depart ${d} before arrive ${a}`);
    }
  }

  for (const constraint of plan.hardConstraints) {
    if (constraint.type === "stay_nights") {
      const v = constraint.value as {
        city?: string;
        nights?: number;
        afterLegIndex?: number;
      };
      const idx = v.afterLegIndex ?? 0;
      const stayNights = v.nights;
      if (stayNights == null || idx >= flights.length - 1) {
        violations.push(constraint.description || "Stay nights unspecified");
        continue;
      }
      const arrive = arriveDate(flights[idx]);
      const leave = departDate(flights[idx + 1]);
      const actual = calendarNightsBetween(arrive, leave);
      if (actual == null) {
        violations.push(`Cannot compute stay for ${constraint.description}`);
      } else if (actual !== stayNights) {
        violations.push(
          `${constraint.description}: need ${stayNights} night(s), got ${actual}`,
        );
      }
      if (v.city) {
        const city = v.city.toUpperCase();
        const dest = flights[idx].destinationCode;
        if (dest !== city && !sameMetro(dest, city)) {
          violations.push(`Stay city ${city} not matched by ${dest}`);
        }
      }
    }

    if (constraint.type === "return_depart_city") {
      const iata = String((constraint.value as { iata?: string })?.iata || "").toUpperCase();
      if (!iata) continue;
      const last = flights[flights.length - 1];
      if (last.originCode !== iata && !sameMetro(last.originCode, iata)) {
        violations.push(`Return must depart ${iata}, got ${last.originCode}`);
      }
    }

    if (constraint.type === "visit_destination") {
      const iata = String((constraint.value as { iata?: string })?.iata || "").toUpperCase();
      if (!iata) continue;
      const hit = flights.some((f) => {
        if (f.destinationCode === iata || sameMetro(f.destinationCode, iata)) return true;
        if (f.originCode === iata || sameMetro(f.originCode, iata)) return true;
        return (f.segments || []).some(
          (s) =>
            s.originCode === iata ||
            s.destinationCode === iata ||
            sameMetro(s.originCode, iata) ||
            sameMetro(s.destinationCode, iata),
        );
      });
      if (!hit) violations.push(`Missing destination ${iata}`);
    }
  }

  if (plan.passengers > 1) {
    // Soft presence check only when offers carry passenger metadata — skip if absent.
  }

  return { satisfied: violations.length === 0, violations };
}

export function applyConstraintGate(
  candidate: ItineraryCandidate,
  plan: PlanningTravelPlan,
): ItineraryCandidate {
  const result = validateHardConstraints(candidate, plan);
  return {
    ...candidate,
    constraints: result,
  };
}

export function filterValidItineraries(
  candidates: ItineraryCandidate[],
  plan: PlanningTravelPlan,
): ItineraryCandidate[] {
  return candidates
    .map((c) => applyConstraintGate(c, plan))
    .filter((c) => c.constraints.satisfied);
}

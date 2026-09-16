import type { FlightOffer, Offer } from "@/lib/inventory/types";
import { isFlight } from "@/lib/inventory/types";
import { metroCanonical } from "./altAirports";

/**
 * Collapse near-identical fares that only differ by metro airport (BKK vs DMK).
 * Prefers the requested destination/origin IATA when price/time/airline match.
 */
export function collapseMetroLookalikeFlights(
  offers: Offer[],
  preferDestIata?: string,
  preferOriginIata?: string,
): Offer[] {
  const flights = offers.filter(isFlight);
  if (flights.length <= 1) return offers;

  const preferDest = preferDestIata?.toUpperCase();
  const preferOrigin = preferOriginIata?.toUpperCase();

  const groups = new Map<string, FlightOffer[]>();
  for (const f of flights) {
    const key = lookalikeKey(f);
    const bucket = groups.get(key) || [];
    bucket.push(f);
    groups.set(key, bucket);
  }

  const kept: FlightOffer[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      kept.push(bucket[0]);
      continue;
    }
    kept.push(pickPreferredAirport(bucket, preferDest, preferOrigin));
  }

  // Preserve original relative order among survivors.
  const keepIds = new Set(kept.map((f) => f.id));
  return offers.filter((o) => !isFlight(o) || keepIds.has(o.id));
}

/** Export for tests — signature shared by BKK/DMK clones. */
export function lookalikeKey(f: FlightOffer): string {
  const airline = f.airline.toUpperCase().slice(0, 2);
  return [
    metroCanonical(f.originCode),
    metroCanonical(f.destinationCode),
    airline,
    f.departTimeLocal,
    f.durationMinutes,
    f.stops,
    f.netFare.amount,
    f.netFare.currency,
  ].join("|");
}

function pickPreferredAirport(
  bucket: FlightOffer[],
  preferDest?: string,
  preferOrigin?: string,
): FlightOffer {
  const scored = [...bucket].sort((a, b) => {
    const sa = airportScore(a, preferDest, preferOrigin);
    const sb = airportScore(b, preferDest, preferOrigin);
    if (sa !== sb) return sb - sa;
    return a.id.localeCompare(b.id);
  });
  return scored[0];
}

function airportScore(
  f: FlightOffer,
  preferDest?: string,
  preferOrigin?: string,
): number {
  let s = 0;
  if (preferDest && f.destinationCode === preferDest) s += 4;
  if (preferOrigin && f.originCode === preferOrigin) s += 2;
  if (!f.tags.includes("nearby-airport")) s += 1;
  return s;
}

/** Mark GDS results from substitute airports so UI can label them. */
export function tagNearbyAirportFlights(
  flights: FlightOffer[],
  primaryOrigin: string,
  primaryDest: string,
): FlightOffer[] {
  const o = primaryOrigin.toUpperCase();
  const d = primaryDest.toUpperCase();
  return flights.map((f) => {
    const nearby =
      (f.originCode !== o && metroCanonical(f.originCode) === metroCanonical(o)) ||
      (f.destinationCode !== d &&
        metroCanonical(f.destinationCode) === metroCanonical(d));
    if (!nearby || f.tags.includes("nearby-airport")) return f;
    return { ...f, tags: [...f.tags, "nearby-airport"] };
  });
}

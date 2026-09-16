import rawData from "./inventory.data.json";
import { PLACE_TO_IATA } from "./places";
import type { Offer } from "./types";
import { isFlight, isHotel, isPackage } from "./types";

/**
 * Seed inventory access layer (hotels/packages + flight fallback).
 * Live flights come from Travelport via `liveFlights.ts` / the consultant
 * orchestrator — this module stays the offline / hotel seed contract.
 *
 * Seed JSON historically included invented airlineScore / supplierReliability
 * values. Those are stripped on load so ranking never pretends seed data is
 * an authoritative quality feed.
 */
function stripFabricatedQualitySignals(offer: Offer): Offer {
  const next = { ...offer } as Offer & {
    airlineScore?: number | null;
    supplierReliability?: number | null;
  };
  delete next.airlineScore;
  delete next.supplierReliability;
  return next as Offer;
}

const OFFERS = (rawData as unknown as Offer[]).map(stripFabricatedQualitySignals);

export function allOffers(): Offer[] {
  return OFFERS;
}

/** Every place we have inventory for — used for intent matching / disambiguation. */
export function knownPlaces(): string[] {
  const set = new Set<string>(Object.keys(PLACE_TO_IATA));
  for (const o of OFFERS) {
    if (o.type === "hotel") set.add(o.city);
    else {
      set.add(o.origin);
      set.add(o.destination);
    }
  }
  return [...set].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

export interface OfferQuery {
  type?: Offer["type"];
  origin?: string;
  destination?: string;
  /** For hotels; also matched against a package/flight destination. */
  city?: string;
  maxBudgetMinor?: number;
  cabin?: string;
  minStars?: number;
}

const eqCity = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Does this offer serve the requested destination/city at all? */
function matchesPlace(o: Offer, q: OfferQuery): boolean {
  const dest = q.destination ?? q.city;
  if (isHotel(o)) return dest ? eqCity(o.city, dest) : true;
  const originOk = q.origin ? eqCity(o.origin, q.origin) : true;
  const destOk = dest ? eqCity(o.destination, dest) : true;
  return originOk && destOk;
}

/**
 * Retrieval with graceful widening — the heart of "never let the customer walk".
 *
 * Returns two buckets:
 *  - `exact`:  offers matching the requested type + route/city (and budget/cabin).
 *  - `alternatives`: relevant nearby options to pitch when exact is thin or when
 *    the exact match has no price advantage — same destination other types, or
 *    same route without the strict cabin/budget filter.
 *
 * The alternatives bucket is what powers the pivot instead of saying "sorry".
 */
export function search(q: OfferQuery): { exact: Offer[]; alternatives: Offer[] } {
  const dest = q.destination ?? q.city;

  const typeOk = (o: Offer) => (q.type ? o.type === q.type : true);
  const budgetOk = (o: Offer) =>
    q.maxBudgetMinor == null || o.netFare.amount <= q.maxBudgetMinor * 1.15; // 15% stretch
  const cabinOk = (o: Offer) =>
    !q.cabin || !isFlight(o) || o.cabin === q.cabin;
  const starsOk = (o: Offer) =>
    q.minStars == null ||
    (isHotel(o) && o.stars >= q.minStars) ||
    (isPackage(o) && o.stars >= q.minStars) ||
    isFlight(o);

  const placeMatch = OFFERS.filter((o) => matchesPlace(o, q));

  const exact = placeMatch.filter(
    (o) => typeOk(o) && budgetOk(o) && cabinOk(o) && starsOk(o),
  );

  // Alternatives: anything relevant to the destination that ISN'T already exact.
  // Priority 1: same destination, any type/cabin/budget (broaden the ask).
  // Priority 2: if we have almost nothing for the destination, surface top offers
  //             to the same destination regardless (still never empty-handed).
  const exactIds = new Set(exact.map((o) => o.id));
  let alternatives = placeMatch.filter((o) => !exactIds.has(o.id));

  if (dest && exact.length + alternatives.length < 3) {
    // Thin on this exact place — pull other strong offers to the same destination.
    const more = OFFERS.filter(
      (o) => !exactIds.has(o.id) && matchesDestinationLoose(o, dest),
    );
    alternatives = dedupe([...alternatives, ...more]);
  }

  return { exact, alternatives };
}

function matchesDestinationLoose(o: Offer, dest: string): boolean {
  if (isHotel(o)) return eqCity(o.city, dest);
  return eqCity(o.destination, dest) || eqCity(o.origin, dest);
}

function dedupe(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const o of offers) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

export function getOffer(id: string): Offer | undefined {
  return OFFERS.find((o) => o.id === id);
}

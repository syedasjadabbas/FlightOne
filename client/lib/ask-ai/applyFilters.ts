import type { OfferCard } from "@/lib/consultant/types";
import type { FilterPill, FilterPillKind } from "./types";

function groupActiveByKind(pills: FilterPill[]): Map<FilterPillKind, FilterPill[]> {
  const map = new Map<FilterPillKind, FilterPill[]>();
  for (const pill of pills) {
    if (!pill.active) continue;
    const bucket = map.get(pill.kind) ?? [];
    bucket.push(pill);
    map.set(pill.kind, bucket);
  }
  return map;
}

function parseStars(offer: OfferCard): number | null {
  const match = offer.subtitle.match(/(\d)\s*★/);
  return match ? Number(match[1]) : null;
}

function flightStops(offer: OfferCard): number | null {
  return offer.flight?.stops ?? null;
}

function returnStops(offer: OfferCard): number | null {
  return offer.flight?.returnStops ?? null;
}

function isNonstopFlight(offer: OfferCard): boolean {
  if (offer.type !== "flight" || !offer.flight) return false;
  if (offer.flight.stops !== 0) return false;
  const ret = offer.flight.returnStops;
  return ret == null || ret === 0;
}

function matchesMaxStops(offer: OfferCard, maxStops: number): boolean {
  if (offer.type !== "flight" || !offer.flight) return true;
  const out = offer.flight.stops;
  if (out > maxStops) return false;
  const ret = offer.flight.returnStops;
  if (ret != null && ret > maxStops) return false;
  return true;
}

function airlineCode(offer: OfferCard): string | null {
  if (offer.flight?.airlineCode) return offer.flight.airlineCode.toUpperCase();
  return null;
}

function matchesAirline(offer: OfferCard, code: string): boolean {
  const normalized = code.toUpperCase();
  const iata = airlineCode(offer);
  if (iata) return iata === normalized;
  if (offer.type === "package") {
    return offer.subtitle.toUpperCase().includes(normalized);
  }
  return false;
}

function matchesStars(offer: OfferCard, minStars: number): boolean {
  if (offer.type !== "hotel" && offer.type !== "package") return false;
  const stars = parseStars(offer);
  if (stars == null) return false;
  return stars >= minStars;
}

function matchesType(offer: OfferCard, type: string): boolean {
  return offer.type === type;
}

function parseLocalTimeMinutes(t: string): number | null {
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function offerLayoverMinutes(offer: OfferCard): number {
  const segs = offer.flight?.segments;
  if (!segs?.length) return 0;
  return Math.max(0, ...segs.map((s) => s.layoverMinutesAfter ?? 0));
}

function matchesKindPills(offer: OfferCard, kind: FilterPillKind, pills: FilterPill[]): boolean {
  switch (kind) {
    case "nonstop":
      return isNonstopFlight(offer);
    case "max_stops":
      return pills.every((pill) => {
        const max = typeof pill.value === "number" ? pill.value : Number(pill.value);
        return Number.isFinite(max) ? matchesMaxStops(offer, max) : true;
      });
    case "airline":
      return pills.some((pill) => {
        const code = String(pill.value ?? pill.id.replace(/^airline_(only_)?/, ""));
        return code.length > 0 && matchesAirline(offer, code);
      });
    case "refundable":
      if (offer.type === "flight" && offer.flight) return offer.flight.refundable === true;
      return true;
    case "checked_bag":
      if (offer.type === "flight" && offer.flight) {
        return offer.flight.baggageKg != null && offer.flight.baggageKg >= 20;
      }
      return true;
    case "depart_after":
      if (offer.type !== "flight" || !offer.flight) return true;
      return pills.every((pill) => {
        const after = parseLocalTimeMinutes(String(pill.value ?? ""));
        const dep = parseLocalTimeMinutes(offer.flight!.departTimeLocal);
        if (after == null || dep == null) return true;
        return dep >= after;
      });
    case "depart_before":
      if (offer.type !== "flight" || !offer.flight) return true;
      return pills.every((pill) => {
        const before = parseLocalTimeMinutes(String(pill.value ?? ""));
        const dep = parseLocalTimeMinutes(offer.flight!.departTimeLocal);
        if (before == null || dep == null) return true;
        return dep <= before;
      });
    case "max_layover":
      if (offer.type !== "flight" || !offer.flight) return true;
      return pills.every((pill) => {
        const max = typeof pill.value === "number" ? pill.value : Number(pill.value);
        if (!Number.isFinite(max)) return true;
        const layover = offerLayoverMinutes(offer);
        return layover === 0 || layover <= max;
      });
    case "budget":
      return pills.every((pill) => {
        const max = typeof pill.value === "number" ? pill.value : Number(pill.value);
        return Number.isFinite(max) ? offer.priceMinor <= max : true;
      });
    case "stars":
      return pills.every((pill) => {
        const min = typeof pill.value === "number" ? pill.value : Number(pill.value);
        return Number.isFinite(min) ? matchesStars(offer, min) : true;
      });
    case "type":
      return pills.some((pill) => matchesType(offer, String(pill.value ?? "")));
    default:
      return true;
  }
}

/** Client-side refinement — active pills AND across kinds, OR within airline/type. */
export function applyFilterPills(offers: OfferCard[], pills: FilterPill[]): OfferCard[] {
  const byKind = groupActiveByKind(pills);
  if (byKind.size === 0) return offers;

  return offers.filter((offer) => {
    for (const [kind, kindPills] of byKind) {
      if (!matchesKindPills(offer, kind, kindPills)) return false;
    }
    return true;
  });
}

/** Toggle one pill's active state by id; leaves other pills unchanged. */
export function togglePill(pills: FilterPill[], id: string): FilterPill[] {
  return pills.map((pill) => (pill.id === id ? { ...pill, active: !pill.active } : pill));
}

export type ResultsTab = "all" | "flights" | "stays" | "packages" | "trips";

export function filterByTab(offers: OfferCard[], tab: ResultsTab): OfferCard[] {
  switch (tab) {
    case "flights":
      return offers.filter((o) => o.type === "flight");
    case "stays":
      return offers.filter((o) => o.type === "hotel");
    case "packages":
      return offers.filter((o) => o.type === "package");
    case "trips":
      return [];
    default:
      return offers;
  }
}

/** Read helpers exported for tests and panel diagnostics. */
export const filterHelpers = {
  parseStars,
  flightStops,
  returnStops,
  isNonstopFlight,
};

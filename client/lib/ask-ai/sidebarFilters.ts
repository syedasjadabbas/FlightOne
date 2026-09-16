import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import { segmentCarrierCodes } from "@/lib/ask-ai/itineraryKey";
import { hasCheckedBaggageIncluded } from "@/lib/inventory/fareDisplay";
import type { FilterPill } from "./types";

/** Minutes since midnight from "HH:MM" local time. */
export function parseLocalTimeMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return min === 0 ? `${h12} ${ampm}` : `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

export interface LegAirportFacet {
  legIndex: number;
  label: string;
  /** Departure airports seen on this leg. */
  depart: string[];
  /** Arrival airports seen on this leg. */
  arrive: string[];
  takeoffMin: number;
  takeoffMax: number;
  /** Arrival time window bounds (minutes since midnight). */
  arrivalMin: number;
  arrivalMax: number;
}

export interface AirlineFacet {
  code: string;
  label: string;
  count: number;
}

export interface CabinFacet {
  id: "economy" | "premium" | "business";
  label: string;
  count: number;
}

export interface SidebarFilterFacets {
  legs: LegAirportFacet[];
  durationMin: number;
  durationMax: number;
  layoverMin: number;
  layoverMax: number;
  hasNonstop: boolean;
  hasOneStop: boolean;
  hasTwoPlus: boolean;
  airlines: AirlineFacet[];
  cabins: CabinFacet[];
  priceMin: number;
  priceMax: number;
  currency: string;
  hasBaggageOptions: boolean;
}

export interface SidebarFilterState {
  stopsNonstop: boolean;
  stopsOne: boolean;
  stopsTwoPlus: boolean;
  /** legIndex → enabled departure airport codes (empty = all). */
  departAirports: Record<number, string[]>;
  /** legIndex → enabled arrival airport codes (empty = all). */
  arriveAirports: Record<number, string[]>;
  takeoffRanges: Record<number, { min: number; max: number }>;
  /** legIndex → arrival time window (minutes since midnight). */
  arrivalRanges: Record<number, { min: number; max: number }>;
  durationMin: number;
  durationMax: number;
  layoverMin: number;
  layoverMax: number;
  /** Empty = all airlines. */
  airlines: string[];
  /** Empty = all cabins. */
  cabins: Array<"economy" | "premium" | "business">;
  priceMin: number;
  priceMax: number;
  /** When true, require checked bag (≥20kg). */
  requireCheckedBag: boolean;
}

function unique(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const u = c.toUpperCase();
    if (!/^[A-Z]{3}$/.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function offerMaxStops(offer: OfferCard): number | null {
  if (offer.type !== "flight" || !offer.flight) return null;
  const out = offer.flight.stops;
  const ret = offer.flight.returnStops;
  return ret == null ? out : Math.max(out, ret);
}

export function offerLayoverMinutes(offer: OfferCard): number {
  const f = offer.flight;
  if (!f?.segments?.length) return 0;
  return Math.max(0, ...f.segments.map((s) => s.layoverMinutesAfter ?? 0));
}

function itineraryTotalDuration(it: ItinerarySummary): number {
  if (!it.legs?.length) return 0;
  return it.legs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
}

function itineraryMaxLayover(it: ItinerarySummary): number {
  if (!it.legs?.length) return 0;
  return Math.max(0, ...it.legs.map((leg) => leg.maxLayoverMinutes ?? 0));
}

function itineraryMaxStops(it: ItinerarySummary): number {
  if (!it.legs?.length) return 0;
  return Math.max(0, ...it.legs.map((leg) => leg.stops));
}

function cabinLabel(cabin: "economy" | "premium" | "business"): string {
  if (cabin === "business") return "Business";
  if (cabin === "premium") return "Premium Economy";
  return "Economy";
}

function collectLegRows(
  offers: OfferCard[],
  itineraries: ItinerarySummary[],
): Array<{
  originCode: string;
  destinationCode: string;
  departMin: number | null;
  arriveMin: number | null;
  durationMinutes: number;
  maxLayoverMinutes: number;
  stops: number;
}> {
  const rows: Array<{
    originCode: string;
    destinationCode: string;
    departMin: number | null;
    arriveMin: number | null;
    durationMinutes: number;
    maxLayoverMinutes: number;
    stops: number;
  }> = [];

  for (const it of itineraries) {
    for (const leg of it.legs ?? []) {
      rows.push({
        originCode: leg.originCode,
        destinationCode: leg.destinationCode,
        departMin: parseLocalTimeMinutes(leg.departTimeLocal),
        arriveMin: leg.arriveTimeLocal ? parseLocalTimeMinutes(leg.arriveTimeLocal) : null,
        durationMinutes: leg.durationMinutes,
        maxLayoverMinutes: leg.maxLayoverMinutes ?? 0,
        stops: leg.stops,
      });
    }
  }

  if (rows.length === 0) {
    for (const offer of offers) {
      const f = offer.flight;
      if (!f) continue;
      rows.push({
        originCode: f.originCode,
        destinationCode: f.destinationCode,
        departMin: parseLocalTimeMinutes(f.departTimeLocal),
        arriveMin: f.arriveTimeLocal ? parseLocalTimeMinutes(f.arriveTimeLocal) : null,
        durationMinutes: f.durationMinutes,
        maxLayoverMinutes: offerLayoverMinutes(offer),
        stops: f.stops,
      });
    }
  }

  return rows;
}

/** Aggregate facet bounds from current result set. */
export function buildSidebarFilterFacets(
  offers: OfferCard[],
  itineraries: ItinerarySummary[],
): SidebarFilterFacets | null {
  const rows = collectLegRows(offers, itineraries);
  const flightOffers = offers.filter((o) => o.type === "flight" && o.flight);
  if (rows.length === 0 && flightOffers.length === 0 && itineraries.length === 0) {
    return null;
  }

  const legMap = new Map<
    string,
    {
      legIndex: number;
      label: string;
      depart: Set<string>;
      arrive: Set<string>;
      takeoffMins: number[];
      arrivalMins: number[];
    }
  >();

  let legIndex = 0;
  for (const row of rows) {
    const key = `${row.originCode}-${row.destinationCode}`;
    let bucket = legMap.get(key);
    if (!bucket) {
      bucket = {
        legIndex: legIndex++,
        label: `${row.originCode} → ${row.destinationCode}`,
        depart: new Set<string>(),
        arrive: new Set<string>(),
        takeoffMins: [],
        arrivalMins: [],
      };
      legMap.set(key, bucket);
    }
    bucket.depart.add(row.originCode);
    bucket.arrive.add(row.destinationCode);
    if (row.departMin != null) bucket.takeoffMins.push(row.departMin);
    if (row.arriveMin != null) bucket.arrivalMins.push(row.arriveMin);
  }

  const legs: LegAirportFacet[] = [...legMap.values()].map((b) => {
    const depMins = b.takeoffMins.length ? b.takeoffMins : [360, 1080];
    const arrMins = b.arrivalMins.length ? b.arrivalMins : depMins;
    return {
      legIndex: b.legIndex,
      label: b.label,
      depart: [...b.depart].sort(),
      arrive: [...b.arrive].sort(),
      takeoffMin: Math.min(...depMins),
      takeoffMax: Math.max(...depMins),
      arrivalMin: Math.min(...arrMins),
      arrivalMax: Math.max(...arrMins),
    };
  });

  const durations = [
    ...rows.map((r) => r.durationMinutes),
    ...itineraries.map(itineraryTotalDuration),
    ...flightOffers.map((o) => o.flight!.durationMinutes),
  ].filter((n) => n > 0);

  const layovers = [
    ...rows.map((r) => r.maxLayoverMinutes),
    ...itineraries.map(itineraryMaxLayover),
    ...offers.map(offerLayoverMinutes),
  ].filter((n) => n > 0);

  const stopCounts = [
    ...rows.map((r) => r.stops),
    ...itineraries.map(itineraryMaxStops),
    ...offers.map(offerMaxStops).filter((n): n is number => n != null),
  ];

  const airlineMap = new Map<string, AirlineFacet>();
  for (const offer of flightOffers) {
    const codes = segmentCarrierCodes(offer.flight!);
    for (const code of codes) {
      if (!code) continue;
      const prev = airlineMap.get(code);
      if (prev) {
        prev.count += 1;
      } else {
        airlineMap.set(code, {
          code,
          label: offer.flight!.airline || code,
          count: 1,
        });
      }
    }
  }

  const cabinMap = new Map<"economy" | "premium" | "business", number>();
  for (const offer of flightOffers) {
    const cabin = offer.flight!.cabin;
    cabinMap.set(cabin, (cabinMap.get(cabin) ?? 0) + 1);
  }

  const prices = [
    ...flightOffers.map((o) => o.priceMinor),
    ...itineraries.map((it) => it.totalPriceMinor),
  ].filter((n) => Number.isFinite(n) && n > 0);

  const currency =
    flightOffers.find((o) => o.currency)?.currency ||
    itineraries.find((it) => it.currency)?.currency ||
    "PKR";

  const durationMin = durations.length ? Math.min(...durations) : 0;
  const durationMax = durations.length ? Math.max(...durations) : 24 * 60;
  const layoverMin = layovers.length ? Math.min(...layovers) : 0;
  const layoverMax = layovers.length ? Math.max(...layovers) : 480;
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;

  const cabins: CabinFacet[] = (["economy", "premium", "business"] as const)
    .filter((id) => cabinMap.has(id))
    .map((id) => ({
      id,
      label: cabinLabel(id),
      count: cabinMap.get(id) ?? 0,
    }));

  return {
    legs,
    durationMin,
    durationMax,
    layoverMin,
    layoverMax,
    hasNonstop: stopCounts.some((s) => s === 0),
    hasOneStop: stopCounts.some((s) => s === 1),
    hasTwoPlus: stopCounts.some((s) => s >= 2),
    airlines: [...airlineMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    cabins,
    priceMin,
    priceMax,
    currency,
    hasBaggageOptions: flightOffers.some((o) =>
      hasCheckedBaggageIncluded(o.flight?.baggageAllowance, o.flight?.baggageKg),
    ),
  };
}

export function defaultSidebarFilters(facets: SidebarFilterFacets): SidebarFilterState {
  const takeoffRanges: Record<number, { min: number; max: number }> = {};
  const arrivalRanges: Record<number, { min: number; max: number }> = {};
  for (const leg of facets.legs) {
    takeoffRanges[leg.legIndex] = { min: leg.takeoffMin, max: leg.takeoffMax };
    arrivalRanges[leg.legIndex] = { min: leg.arrivalMin, max: leg.arrivalMax };
  }
  return {
    stopsNonstop: facets.hasNonstop,
    stopsOne: facets.hasOneStop,
    stopsTwoPlus: facets.hasTwoPlus,
    departAirports: {},
    arriveAirports: {},
    takeoffRanges,
    arrivalRanges,
    durationMin: facets.durationMin,
    durationMax: facets.durationMax,
    layoverMin: facets.layoverMin,
    layoverMax: facets.layoverMax,
    airlines: [],
    cabins: [],
    priceMin: facets.priceMin,
    priceMax: facets.priceMax,
    requireCheckedBag: false,
  };
}

/**
 * Seed sidebar controls from active NL filter pills so chat refinements
 * and manual filters share one visible search state.
 */
export function seedSidebarFiltersFromPills(
  facets: SidebarFilterFacets,
  pills: FilterPill[],
): SidebarFilterState {
  const state = defaultSidebarFilters(facets);
  const active = pills.filter((p) => p.active);
  if (active.length === 0) return state;

  const nonstop = active.find((p) => p.kind === "nonstop");
  const maxStops = active.find((p) => p.kind === "max_stops");
  if (nonstop) {
    // Only tighten stops when nonstop inventory exists — otherwise leave defaults
    // so a mismatched NL pill cannot zero out the entire result set.
    if (facets.hasNonstop) {
      state.stopsNonstop = true;
      state.stopsOne = false;
      state.stopsTwoPlus = false;
    }
  } else if (maxStops) {
    const max = typeof maxStops.value === "number" ? maxStops.value : Number(maxStops.value);
    if (max === 0 && facets.hasNonstop) {
      state.stopsNonstop = true;
      state.stopsOne = false;
      state.stopsTwoPlus = false;
    } else if (max === 1) {
      state.stopsNonstop = facets.hasNonstop;
      state.stopsOne = facets.hasOneStop;
      state.stopsTwoPlus = false;
      if (!state.stopsNonstop && !state.stopsOne && facets.hasTwoPlus) {
        state.stopsTwoPlus = true;
      }
    }
  }

  const airlineCodes = active
    .filter((p) => p.kind === "airline")
    .map((p) => String(p.value ?? "").toUpperCase())
    .filter((c) => facets.airlines.some((a) => a.code === c));
  if (airlineCodes.length) state.airlines = [...new Set(airlineCodes)];

  if (active.some((p) => p.kind === "checked_bag") && facets.hasBaggageOptions) {
    state.requireCheckedBag = true;
  }

  const budget = active.find((p) => p.kind === "budget");
  if (budget && typeof budget.value === "number" && budget.value > 0 && facets.priceMax > 0) {
    state.priceMax = Math.min(state.priceMax > 0 ? state.priceMax : budget.value, budget.value);
    if (state.priceMax < state.priceMin) state.priceMax = state.priceMin;
  }

  const maxLayover = active.find((p) => p.kind === "max_layover");
  if (maxLayover && typeof maxLayover.value === "number" && facets.layoverMax > facets.layoverMin) {
    state.layoverMax = Math.min(state.layoverMax, maxLayover.value);
    if (state.layoverMax < state.layoverMin) state.layoverMax = state.layoverMin;
  }

  const after = active.find((p) => p.kind === "depart_after");
  const before = active.find((p) => p.kind === "depart_before");
  if (after || before) {
    const afterMin = after ? parseLocalTimeMinutes(String(after.value ?? "")) : null;
    const beforeMin = before ? parseLocalTimeMinutes(String(before.value ?? "")) : null;
    for (const leg of facets.legs) {
      const range = state.takeoffRanges[leg.legIndex] ?? {
        min: leg.takeoffMin,
        max: leg.takeoffMax,
      };
      const nextMin = afterMin != null ? Math.max(range.min, afterMin) : range.min;
      const nextMax = beforeMin != null ? Math.min(range.max, beforeMin) : range.max;
      // Keep the full facet window if pill seeding would invert the range.
      state.takeoffRanges[leg.legIndex] =
        nextMin <= nextMax ? { min: nextMin, max: nextMax } : { min: leg.takeoffMin, max: leg.takeoffMax };
    }
  }

  return state;
}

function stopsAllowed(
  maxStops: number,
  state: SidebarFilterState,
  facets: SidebarFilterFacets,
): boolean {
  const allowed: boolean[] = [];
  if (facets.hasNonstop && state.stopsNonstop) allowed.push(maxStops === 0);
  if (facets.hasOneStop && state.stopsOne) allowed.push(maxStops === 1);
  if (facets.hasTwoPlus && state.stopsTwoPlus) allowed.push(maxStops >= 2);
  if (allowed.length === 0) return false;
  return allowed.some(Boolean);
}

function matchesLegAirports(
  legIndex: number,
  originCode: string,
  destinationCode: string,
  state: SidebarFilterState,
): boolean {
  const depEnabled = state.departAirports[legIndex];
  if (depEnabled?.length && !depEnabled.includes(originCode.toUpperCase())) return false;
  const arrEnabled = state.arriveAirports[legIndex];
  if (arrEnabled?.length && !arrEnabled.includes(destinationCode.toUpperCase())) return false;
  return true;
}

function matchesTakeoff(
  legIndex: number,
  departTimeLocal: string,
  state: SidebarFilterState,
): boolean {
  const range = state.takeoffRanges[legIndex];
  if (!range) return true;
  const min = parseLocalTimeMinutes(departTimeLocal);
  if (min == null) return true;
  return min >= range.min && min <= range.max;
}

function matchesArrival(
  legIndex: number,
  arriveTimeLocal: string | null | undefined,
  state: SidebarFilterState,
): boolean {
  if (!arriveTimeLocal) return true;
  const range = state.arrivalRanges?.[legIndex];
  if (!range || range.min > range.max) return true;
  const min = parseLocalTimeMinutes(arriveTimeLocal);
  if (min == null) return true;
  return min >= range.min && min <= range.max;
}

function matchesOfferExtras(
  offer: OfferCard,
  state: SidebarFilterState,
  facets: SidebarFilterFacets,
): boolean {
  if (offer.type !== "flight" || !offer.flight) return true;
  const f = offer.flight;

  if (state.airlines.length > 0) {
    const codes = segmentCarrierCodes(f);
    if (!codes.some((c) => state.airlines.includes(c))) return false;
  }

  if (state.cabins.length > 0 && !state.cabins.includes(f.cabin)) return false;

  if (state.requireCheckedBag) {
    if (!hasCheckedBaggageIncluded(f.baggageAllowance, f.baggageKg)) return false;
  }

  // Only enforce price when facets have a real range (priceMax > priceMin).
  // priceMin=priceMax=0 means "no price data" — never treat that as a PKR 0 cap.
  if (facets.priceMax > facets.priceMin && offer.priceMinor > 0) {
    if (offer.priceMinor < state.priceMin || offer.priceMinor > state.priceMax) {
      return false;
    }
  }

  return true;
}

/** Client-side sidebar refinement for flight offers. */
export function applySidebarFiltersToOffers(
  offers: OfferCard[],
  state: SidebarFilterState,
  facets: SidebarFilterFacets,
): OfferCard[] {
  return offers.filter((offer) => {
    if (offer.type !== "flight" || !offer.flight) return true;
    const f = offer.flight;
    const maxStops = offerMaxStops(offer);
    if (maxStops != null && !stopsAllowed(maxStops, state, facets)) return false;

    // Skip duration when unknown (0) so incomplete cards are not wiped.
    if (f.durationMinutes > 0) {
      if (f.durationMinutes < state.durationMin || f.durationMinutes > state.durationMax) {
        return false;
      }
    }

    const layover = offerLayoverMinutes(offer);
    if (
      layover > 0 &&
      facets.layoverMax > facets.layoverMin &&
      (layover < state.layoverMin || layover > state.layoverMax)
    ) {
      return false;
    }

    const legIdx = facets.legs.find(
      (l) => l.label === `${f.originCode} → ${f.destinationCode}`,
    )?.legIndex;
    if (legIdx != null) {
      if (!matchesLegAirports(legIdx, f.originCode, f.destinationCode, state)) return false;
      const range = state.takeoffRanges[legIdx];
      // Ignore inverted / empty takeoff windows from bad pill seeding.
      if (!range || range.min <= range.max) {
        if (!matchesTakeoff(legIdx, f.departTimeLocal, state)) return false;
      }
      const arrRange = state.arrivalRanges?.[legIdx];
      if (!arrRange || arrRange.min <= arrRange.max) {
        if (!matchesArrival(legIdx, f.arriveTimeLocal, state)) return false;
      }
    }

    if (!matchesOfferExtras(offer, state, facets)) return false;

    return true;
  });
}

/** Client-side sidebar refinement for complete trip cards. */
export function applySidebarFiltersToItineraries(
  itineraries: ItinerarySummary[],
  state: SidebarFilterState,
  facets: SidebarFilterFacets,
): ItinerarySummary[] {
  return itineraries.filter((it) => {
    const maxStops = itineraryMaxStops(it);
    if (!stopsAllowed(maxStops, state, facets)) return false;

    const duration = itineraryTotalDuration(it);
    if (duration > 0 && (duration < state.durationMin || duration > state.durationMax)) {
      return false;
    }

    const layover = itineraryMaxLayover(it);
    if (
      layover > 0 &&
      facets.layoverMax > facets.layoverMin &&
      (layover < state.layoverMin || layover > state.layoverMax)
    ) {
      return false;
    }

    if (facets.priceMax > facets.priceMin && it.totalPriceMinor > 0) {
      if (it.totalPriceMinor < state.priceMin || it.totalPriceMinor > state.priceMax) {
        return false;
      }
    }

    if (state.airlines.length > 0) {
      const codes = (it.legs ?? []).map((l) => (l.airlineCode || "").toUpperCase());
      if (!codes.some((c) => state.airlines.includes(c))) return false;
    }

    if (state.cabins.length > 0) {
      const cabins = (it.legs ?? [])
        .map((l) => l.cabin)
        .filter((c): c is "economy" | "premium" | "business" => Boolean(c));
      if (cabins.length && !cabins.some((c) => state.cabins.includes(c))) return false;
    }

    if (state.requireCheckedBag) {
      const bags = (it.legs ?? []).map((l) => l.baggageKg).filter((n): n is number => n != null);
      if (bags.length && !bags.some((kg) => kg >= 20)) return false;
    }

    for (let i = 0; i < (it.legs?.length ?? 0); i++) {
      const leg = it.legs![i];
      const facetLeg = facets.legs.find(
        (l) => l.label === `${leg.originCode} → ${leg.destinationCode}`,
      );
      const legIdx = facetLeg?.legIndex ?? i;
      if (!matchesLegAirports(legIdx, leg.originCode, leg.destinationCode, state)) return false;
      const range = state.takeoffRanges[legIdx];
      if (!range || range.min <= range.max) {
        if (!matchesTakeoff(legIdx, leg.departTimeLocal, state)) return false;
      }
    }

    return true;
  });
}

/** Toggle one airport checkbox; empty enabled list means all airports. */
export function toggleLegAirport(
  state: SidebarFilterState,
  legIndex: number,
  role: "depart" | "arrive",
  code: string,
  allCodes: string[],
  enabled: boolean,
): SidebarFilterState {
  const key = role === "depart" ? "departAirports" : "arriveAirports";
  const current = state[key][legIndex] ?? [...allCodes];
  let next: string[];
  if (enabled) {
    next = unique([...current, code]);
  } else {
    next = current.filter((c) => c !== code);
  }
  if (next.length === 0 || next.length === allCodes.length) {
    const { [legIndex]: _, ...rest } = state[key];
    return { ...state, [key]: rest };
  }
  return { ...state, [key]: { ...state[key], [legIndex]: next } };
}

export function isAirportEnabled(
  state: SidebarFilterState,
  legIndex: number,
  role: "depart" | "arrive",
  code: string,
  allCodes: string[],
): boolean {
  const key = role === "depart" ? "departAirports" : "arriveAirports";
  const enabled = state[key][legIndex];
  if (!enabled?.length) return true;
  return enabled.includes(code);
}

export function formatPriceMinor(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${currency} ${Math.round(major).toLocaleString()}`;
  }
}

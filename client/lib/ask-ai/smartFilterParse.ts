import type { SidebarFilterFacets, SidebarFilterState } from "./sidebarFilters";
import { parseLocalTimeMinutes } from "./sidebarFilters";

export interface SmartFilterParseResult {
  /** Partial sidebar state to merge when client-side rules matched. */
  patch: Partial<SidebarFilterState> | null;
  /** When true, forward the raw text to Ava for a re-search or unsupported refinement. */
  needsAva: boolean;
  /** Short UI hint after applying client filters. */
  message?: string;
}

const MORNING = { min: 5 * 60, max: 12 * 60 };
const AFTERNOON = { min: 12 * 60, max: 17 * 60 };
const EVENING = { min: 17 * 60, max: 22 * 60 };
const NIGHT = { min: 22 * 60, max: 24 * 60 - 1 };

function parseMoneyMinor(text: string, currency: string): number | null {
  const normalized = text.replace(/,/g, "");
  const pkr = normalized.match(/(?:pkr|rs\.?|₨)\s*([\d.]+)/i);
  if (pkr) return Math.round(Number(pkr[1]) * 100);
  const usd = normalized.match(/\$\s*([\d.]+)/);
  if (usd) return Math.round(Number(usd[1]) * 100);
  const bare = normalized.match(/under\s+([\d.]+)\s*k/i);
  if (bare) return Math.round(Number(bare[1]) * 1000 * 100);
  const num = normalized.match(/under\s+([\d,]+)/i);
  if (num) return Math.round(Number(num[1].replace(/,/g, "")) * 100);
  if (currency === "PKR" && /under\s+(\d+)/i.test(normalized)) {
    const m = normalized.match(/under\s+(\d+)/i);
    if (m) return Math.round(Number(m[1]) * 100);
  }
  return null;
}

function airlineCodesFromText(
  text: string,
  facets: SidebarFilterFacets,
): string[] {
  const lower = text.toLowerCase();
  const codes: string[] = [];
  for (const a of facets.airlines) {
    if (lower.includes(a.label.toLowerCase()) || lower.includes(a.code.toLowerCase())) {
      codes.push(a.code);
    }
  }
  return codes;
}

function cabinFromText(text: string): SidebarFilterState["cabins"] | null {
  const lower = text.toLowerCase();
  if (/\bbusiness\b/.test(lower)) return ["business"];
  if (/\bpremium economy\b/.test(lower)) return ["premium"];
  if (/\beconomy\b/.test(lower)) return ["economy"];
  return null;
}

/** Map natural-language smart filter text onto existing sidebar state. */
export function parseSmartFilter(
  text: string,
  facets: SidebarFilterFacets,
  filters: SidebarFilterState,
): SmartFilterParseResult {
  const lower = text.toLowerCase().trim();
  if (!lower) return { patch: null, needsAva: false };

  const patch: Partial<SidebarFilterState> = {};
  let matched = false;

  if (/\bnonstop\b|\bnon-stop\b|\bdirect only\b/.test(lower)) {
    if (facets.hasNonstop) {
      patch.stopsNonstop = true;
      patch.stopsOne = false;
      patch.stopsTwoPlus = false;
      matched = true;
    }
  } else if (/\bone stop\b|\bmax(?:imum)?\s*1\s*stop\b|\bat most one stop\b/.test(lower)) {
    patch.stopsNonstop = facets.hasNonstop;
    patch.stopsOne = facets.hasOneStop;
    patch.stopsTwoPlus = false;
    matched = true;
  } else if (/\b2\+\s*stops\b|\btwo\+?\s*stops\b/.test(lower)) {
    patch.stopsTwoPlus = true;
    matched = true;
  }

  const airlines = airlineCodesFromText(lower, facets);
  if (airlines.length) {
    patch.airlines = airlines;
    matched = true;
  }

  const cabin = cabinFromText(lower);
  if (cabin) {
    patch.cabins = cabin;
    matched = true;
  }

  if (/\bchecked bag\b|\bchecked baggage\b|\binclude(?:d)? bag\b|\bwith bag\b/.test(lower)) {
    if (facets.hasBaggageOptions) {
      patch.requireCheckedBag = true;
      matched = true;
    }
  }

  const budget = parseMoneyMinor(lower, facets.currency);
  if (budget != null && facets.priceMax > facets.priceMin) {
    patch.priceMax = Math.min(filters.priceMax || facets.priceMax, budget);
    patch.priceMin = filters.priceMin || facets.priceMin;
    matched = true;
  }

  if (/\bavoid long layover\b|\bshort layover\b|\bmax layover\b/.test(lower)) {
    if (facets.layoverMax > facets.layoverMin) {
      const cap = Math.min(facets.layoverMax, 180);
      patch.layoverMax = Math.max(facets.layoverMin, cap);
      patch.layoverMin = facets.layoverMin;
      matched = true;
    }
  }

  const takeoffRanges = { ...filters.takeoffRanges };
  const arrivalRanges = { ...(filters.arrivalRanges ?? {}) };
  let timeMatched = false;

  const departWindow =
    /\bmorning\b/.test(lower)
      ? MORNING
      : /\bafternoon\b/.test(lower)
        ? AFTERNOON
        : /\bevening\b/.test(lower)
          ? EVENING
          : /\bnight\b|\bred-eye\b/.test(lower)
            ? NIGHT
            : null;

  if (departWindow && (/\bdepart|\btakeoff|\bmorning flight|\bafternoon flight/.test(lower) || !/\barriv/.test(lower))) {
    for (const leg of facets.legs) {
      takeoffRanges[leg.legIndex] = {
        min: Math.max(leg.takeoffMin, departWindow.min),
        max: Math.min(leg.takeoffMax, departWindow.max),
      };
    }
    timeMatched = true;
  }

  const arriveBefore = lower.match(/arriv(?:e|al)\s+before\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (arriveBefore) {
    const min = parseLocalTimeMinutes(arriveBefore[1].trim());
    if (min != null) {
      for (const leg of facets.legs) {
        arrivalRanges[leg.legIndex] = {
          min: leg.arrivalMin,
          max: Math.min(leg.arrivalMax, min),
        };
      }
      timeMatched = true;
    }
  }

  if (timeMatched) {
    patch.takeoffRanges = takeoffRanges;
    patch.arrivalRanges = arrivalRanges;
    matched = true;
  }

  const needsAva =
    /\bflexible date\b|\b±\s*3\b|\bnearby airport\b|\bweekend\b|\bnext month\b|\bexplore\b|\bhacker fare\b|\btrack price\b|\bprice alert\b/.test(
      lower,
    ) || (!matched && lower.length > 8);

  if (!matched && needsAva) {
    return { patch: null, needsAva: true };
  }

  if (matched) {
    return {
      patch,
      needsAva,
      message: needsAva
        ? "Applied what we could locally. Ava will refine the rest."
        : "Filters updated.",
    };
  }

  return { patch: null, needsAva: true };
}

export function mergeSmartFilterPatch(
  filters: SidebarFilterState,
  patch: Partial<SidebarFilterState>,
): SidebarFilterState {
  return {
    ...filters,
    ...patch,
    departAirports: patch.departAirports ?? filters.departAirports,
    arriveAirports: patch.arriveAirports ?? filters.arriveAirports,
    takeoffRanges: patch.takeoffRanges ?? filters.takeoffRanges,
    arrivalRanges: patch.arrivalRanges ?? filters.arrivalRanges,
    airlines: patch.airlines ?? filters.airlines,
    cabins: patch.cabins ?? filters.cabins,
  };
}

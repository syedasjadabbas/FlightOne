import type { FilterPill, FilterPillKind } from "./types";

const CLIENT_FILTERABLE: ReadonlySet<FilterPillKind> = new Set([
  "nonstop",
  "max_stops",
  "airline",
  "refundable",
  "checked_bag",
  "depart_after",
  "depart_before",
  "max_layover",
  "budget",
  "stars",
  "type",
]);

export function isClientFilterableKind(kind: FilterPillKind): boolean {
  return CLIENT_FILTERABLE.has(kind);
}

/** Natural-language refinement when an NL pill is removed and needs a re-search. */
export function pillRemovalRefinement(pill: FilterPill): string | null {
  switch (pill.kind) {
    case "nonstop":
    case "max_stops":
      return "include 1-stop flights";
    case "airline":
      return "include other airlines too";
    case "refundable":
      return "include non-refundable fares";
    case "checked_bag":
      return "include fares without checked baggage included";
    case "depart_after":
    case "depart_before":
      return "any departure time is fine";
    case "max_layover":
      return "longer layovers are okay";
    case "stars":
      return "include lower-rated stays";
    case "budget":
      return "show options above my budget too";
    default:
      return null;
  }
}

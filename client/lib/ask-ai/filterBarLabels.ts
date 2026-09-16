import {
  formatMinutesLabel,
  type SidebarFilterFacets,
  type SidebarFilterState,
} from "./sidebarFilters";

function durationShort(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function compactPrice(amount: number, currency: string): string {
  const major = amount / 100;
  if (major >= 1000) {
    const k = major / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${currency} ${rounded}k`;
  }
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

export function stopsFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  const parts: string[] = [];
  if (filters.stopsNonstop && facets.hasNonstop) parts.push("Nonstop");
  if (filters.stopsOne && facets.hasOneStop) parts.push("1 stop");
  if (filters.stopsTwoPlus && facets.hasTwoPlus) parts.push("2+");
  if (parts.length === 0) return "Stops";
  if (parts.length === 1) return `Stops · ${parts[0]}`;
  return `Stops · ${parts.length}`;
}

export function airlinesFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  if (filters.airlines.length === 0) return "Airlines";
  if (filters.airlines.length === 1) {
    const a = facets.airlines.find((x) => x.code === filters.airlines[0]);
    return a ? `Airlines · ${a.label}` : "Airlines · 1";
  }
  return `Airlines · ${filters.airlines.length}`;
}

export function timesFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  const leg = facets.legs[0];
  if (!leg) return "Times";
  const dep = filters.takeoffRanges[leg.legIndex];
  const arr = filters.arrivalRanges?.[leg.legIndex];
  const depActive =
    dep && (dep.min > leg.takeoffMin || dep.max < leg.takeoffMax);
  const arrActive =
    arr && (arr.min > leg.arrivalMin || arr.max < leg.arrivalMax);
  if (depActive && arrActive) return "Times · 2";
  if (depActive) {
    return `Times · ${formatMinutesLabel(dep.min)}–${formatMinutesLabel(dep.max)}`;
  }
  if (arrActive) {
    return `Times · Arr ${formatMinutesLabel(arr.max)}`;
  }
  return "Times";
}

export function priceFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  const active =
    filters.priceMin > facets.priceMin || filters.priceMax < facets.priceMax;
  if (!active) return "Price";
  return `${compactPrice(filters.priceMin, facets.currency)}–${compactPrice(filters.priceMax, facets.currency)}`;
}

export function durationFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  const active =
    filters.durationMin > facets.durationMin ||
    filters.durationMax < facets.durationMax;
  if (!active) return "Duration";
  return `Duration · ${durationShort(filters.durationMin)}–${durationShort(filters.durationMax)}`;
}

export function layoverFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  const active =
    filters.layoverMin > facets.layoverMin ||
    filters.layoverMax < facets.layoverMax;
  if (!active) return "Layover";
  return `Layover · ≤ ${durationShort(filters.layoverMax)}`;
}

export function cabinFilterLabel(
  filters: SidebarFilterState,
  facets: SidebarFilterFacets,
): string {
  if (filters.cabins.length === 0) return "Cabin";
  if (filters.cabins.length === 1) {
    const c = facets.cabins.find((x) => x.id === filters.cabins[0]);
    return c ? `Cabin · ${c.label}` : "Cabin · 1";
  }
  return `Cabin · ${filters.cabins.length}`;
}

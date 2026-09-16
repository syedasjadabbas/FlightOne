"use client";

import type { SidebarFilterFacets, SidebarFilterState } from "@/lib/ask-ai/sidebarFilters";

export function DurationLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function hasActiveFilters(filters: SidebarFilterState, facets: SidebarFilterFacets): boolean {
  if (facets.hasNonstop && !filters.stopsNonstop) return true;
  if (facets.hasOneStop && !filters.stopsOne) return true;
  if (facets.hasTwoPlus && !filters.stopsTwoPlus) return true;
  if (filters.durationMin > facets.durationMin || filters.durationMax < facets.durationMax) {
    return true;
  }
  if (filters.layoverMin > facets.layoverMin || filters.layoverMax < facets.layoverMax) {
    return true;
  }
  if (filters.priceMin > facets.priceMin || filters.priceMax < facets.priceMax) return true;
  if (filters.airlines.length > 0) return true;
  if (filters.cabins.length > 0) return true;
  if (filters.requireCheckedBag) return true;
  for (const leg of facets.legs) {
    const dep = filters.departAirports[leg.legIndex];
    const arrAirports = filters.arriveAirports[leg.legIndex];
    if (dep && dep.length > 0 && dep.length < leg.depart.length) return true;
    if (arrAirports && arrAirports.length > 0 && arrAirports.length < leg.arrive.length) return true;
    const range = filters.takeoffRanges[leg.legIndex];
    if (range && (range.min > leg.takeoffMin || range.max < leg.takeoffMax)) return true;
    const arrTime = filters.arrivalRanges?.[leg.legIndex];
    if (arrTime && (arrTime.min > leg.arrivalMin || arrTime.max < leg.arrivalMax)) return true;
  }
  return false;
}

export function stopsFilterActive(filters: SidebarFilterState, facets: SidebarFilterFacets): boolean {
  if (facets.hasNonstop && !filters.stopsNonstop) return true;
  if (facets.hasOneStop && !filters.stopsOne) return true;
  if (facets.hasTwoPlus && !filters.stopsTwoPlus) return true;
  return false;
}

export function timesFilterActive(filters: SidebarFilterState, facets: SidebarFilterFacets): boolean {
  for (const leg of facets.legs) {
    const dep = filters.takeoffRanges[leg.legIndex];
    if (dep && (dep.min > leg.takeoffMin || dep.max < leg.takeoffMax)) return true;
    const arr = filters.arrivalRanges?.[leg.legIndex];
    if (arr && (arr.min > leg.arrivalMin || arr.max < leg.arrivalMax)) return true;
  }
  return false;
}

export function airportsFilterActive(filters: SidebarFilterState, facets: SidebarFilterFacets): boolean {
  for (const leg of facets.legs) {
    const dep = filters.departAirports[leg.legIndex];
    const arr = filters.arriveAirports[leg.legIndex];
    if (dep && dep.length > 0 && dep.length < leg.depart.length) return true;
    if (arr && arr.length > 0 && arr.length < leg.arrive.length) return true;
  }
  return false;
}

export function FilterChip({
  label,
  active,
  mono,
  onClick,
}: {
  label: string;
  active: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`filter-chip ${active ? "filter-chip--on" : ""} ${mono ? "filter-chip--mono" : ""}`}
    >
      {label}
    </button>
  );
}

export function RangeSlider({
  label,
  min,
  max,
  valueMin,
  valueMax,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  format: (n: number) => string;
  onChange: (min: number, max: number) => void;
}) {
  if (max <= min) return null;

  const span = max - min;
  const fillLeft = ((valueMin - min) / span) * 100;
  const fillRight = 100 - ((valueMax - min) / span) * 100;

  return (
    <div className="filter-range">
      <div className="filter-range__head">
        <span className="filter-range__label">{label}</span>
        <span className="filter-range__value">
          {format(valueMin)} – {format(valueMax)}
        </span>
      </div>
      <div className="filter-range__track-wrap">
        <div className="filter-range__track" aria-hidden />
        <div
          className="filter-range__fill"
          style={{ left: `${fillLeft}%`, right: `${fillRight}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), valueMax);
            onChange(next, valueMax);
          }}
          className="filter-range-input filter-range-input--min"
          aria-label={`${label} minimum`}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), valueMin);
            onChange(valueMin, next);
          }}
          className="filter-range-input filter-range-input--max"
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  );
}

export function LegRouteBadge({ label }: { label: string }) {
  const [origin, destination] = label.split(/\s*→\s*/);
  if (!destination) {
    return (
      <p className="filter-leg__route font-mono text-[12px] font-semibold tracking-tight text-[var(--ink)]">
        {label}
      </p>
    );
  }

  return (
    <div className="filter-leg__route" aria-label={label}>
      <span className="filter-leg__code">{origin}</span>
      <span className="filter-leg__arrow" aria-hidden>
        →
      </span>
      <span className="filter-leg__code">{destination}</span>
    </div>
  );
}

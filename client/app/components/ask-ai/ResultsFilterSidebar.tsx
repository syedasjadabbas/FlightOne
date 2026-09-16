"use client";

import { useMemo, useState } from "react";
import {
  formatMinutesLabel,
  formatPriceMinor,
  isAirportEnabled,
  toggleLegAirport,
  type SidebarFilterFacets,
  type SidebarFilterState,
} from "@/lib/ask-ai/sidebarFilters";

function DurationLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function hasActiveFilters(filters: SidebarFilterState, facets: SidebarFilterFacets): boolean {
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
    const arr = filters.arriveAirports[leg.legIndex];
    if (dep && dep.length > 0 && dep.length < leg.depart.length) return true;
    if (arr && arr.length > 0 && arr.length < leg.arrive.length) return true;
    const range = filters.takeoffRanges[leg.legIndex];
    if (range && (range.min > leg.takeoffMin || range.max < leg.takeoffMax)) return true;
  }
  return false;
}

function FilterChip({
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

function RangeSlider({
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

function LegRouteBadge({ label }: { label: string }) {
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

export function ResultsFilterSidebar({
  facets,
  filters,
  onChange,
  onSendSmartFilter,
  onClear,
}: {
  facets: SidebarFilterFacets;
  filters: SidebarFilterState;
  onChange: (next: SidebarFilterState) => void;
  onSendSmartFilter?: (text: string) => void;
  onClear: () => void;
}) {
  const [smartText, setSmartText] = useState("");
  const showLayover = facets.layoverMax > facets.layoverMin;
  const showPrice = facets.priceMax > facets.priceMin;
  const filtersActive = useMemo(() => hasActiveFilters(filters, facets), [filters, facets]);

  function submitSmartFilter() {
    const trimmed = smartText.trim();
    if (!trimmed || !onSendSmartFilter) return;
    onSendSmartFilter(trimmed);
    setSmartText("");
  }

  const stopOptions = [
    facets.hasNonstop ? { id: "nonstop" as const, label: "Nonstop" } : null,
    facets.hasOneStop ? { id: "one" as const, label: "1 stop" } : null,
    facets.hasTwoPlus ? { id: "twoPlus" as const, label: "2+ stops" } : null,
  ].filter(Boolean) as Array<{ id: "nonstop" | "one" | "twoPlus"; label: string }>;

  return (
    <aside className="results-filter-sidebar" aria-label="Filters">
      <header className="filter-sidebar-head">
        <div>
          <p className="filter-sidebar-head__title">Filters</p>
          <p className="filter-sidebar-head__hint">Narrow results without leaving the page</p>
        </div>
        {filtersActive ? (
          <button type="button" onClick={onClear} className="filter-sidebar-clear">
            Reset
          </button>
        ) : null}
      </header>

      {onSendSmartFilter ? (
        <section className="filter-panel">
          <p className="filter-panel__label">Refine in chat</p>
          <label className="sr-only" htmlFor="smart-filter-input">
            Refine in chat
          </label>
          <textarea
            id="smart-filter-input"
            rows={2}
            value={smartText}
            onChange={(e) => setSmartText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitSmartFilter();
              }
            }}
            placeholder="Morning departures, avoid long layovers…"
            className="filter-smart-input"
          />
          <button
            type="button"
            onClick={submitSmartFilter}
            disabled={!smartText.trim()}
            className="filter-smart-apply"
          >
            Send to Ava
          </button>
        </section>
      ) : null}

      {stopOptions.length > 0 ? (
        <section className="filter-section">
          <p className="filter-section__label">Stops</p>
          <div className="filter-chip-row" role="group" aria-label="Stops">
            {stopOptions.map((opt) => {
              const active =
                opt.id === "nonstop"
                  ? filters.stopsNonstop
                  : opt.id === "one"
                    ? filters.stopsOne
                    : filters.stopsTwoPlus;
              return (
                <FilterChip
                  key={opt.id}
                  label={opt.label}
                  active={active}
                  onClick={() => {
                    if (opt.id === "nonstop") {
                      onChange({ ...filters, stopsNonstop: !filters.stopsNonstop });
                    } else if (opt.id === "one") {
                      onChange({ ...filters, stopsOne: !filters.stopsOne });
                    } else {
                      onChange({ ...filters, stopsTwoPlus: !filters.stopsTwoPlus });
                    }
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {facets.legs.map((leg) => (
        <section key={leg.legIndex} className="filter-leg">
          <LegRouteBadge label={leg.label} />

          {leg.depart.length > 1 ? (
            <div className="filter-leg__group">
              <p className="filter-leg__sublabel">Depart from</p>
              <div className="filter-chip-row" role="group" aria-label={`Depart ${leg.label}`}>
                {leg.depart.map((code) => {
                  const enabled = isAirportEnabled(
                    filters,
                    leg.legIndex,
                    "depart",
                    code,
                    leg.depart,
                  );
                  return (
                    <FilterChip
                      key={`dep-${code}`}
                      label={code}
                      mono
                      active={enabled}
                      onClick={() =>
                        onChange(
                          toggleLegAirport(
                            filters,
                            leg.legIndex,
                            "depart",
                            code,
                            leg.depart,
                            !enabled,
                          ),
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {leg.arrive.length > 1 ? (
            <div className="filter-leg__group">
              <p className="filter-leg__sublabel">Arrive at</p>
              <div className="filter-chip-row" role="group" aria-label={`Arrive ${leg.label}`}>
                {leg.arrive.map((code) => {
                  const enabled = isAirportEnabled(
                    filters,
                    leg.legIndex,
                    "arrive",
                    code,
                    leg.arrive,
                  );
                  return (
                    <FilterChip
                      key={`arr-${code}`}
                      label={code}
                      mono
                      active={enabled}
                      onClick={() =>
                        onChange(
                          toggleLegAirport(
                            filters,
                            leg.legIndex,
                            "arrive",
                            code,
                            leg.arrive,
                            !enabled,
                          ),
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <RangeSlider
            label="Takeoff"
            min={leg.takeoffMin}
            max={leg.takeoffMax}
            valueMin={filters.takeoffRanges[leg.legIndex]?.min ?? leg.takeoffMin}
            valueMax={filters.takeoffRanges[leg.legIndex]?.max ?? leg.takeoffMax}
            format={formatMinutesLabel}
            onChange={(min, max) =>
              onChange({
                ...filters,
                takeoffRanges: { ...filters.takeoffRanges, [leg.legIndex]: { min, max } },
              })
            }
          />
        </section>
      ))}

      <section className="filter-section">
        <p className="filter-section__label">Trip totals</p>
        <div className="filter-range-stack">
          <RangeSlider
            label="Duration"
            min={facets.durationMin}
            max={facets.durationMax}
            valueMin={filters.durationMin}
            valueMax={filters.durationMax}
            format={DurationLabel}
            onChange={(min, max) => onChange({ ...filters, durationMin: min, durationMax: max })}
          />
          {showLayover ? (
            <RangeSlider
              label="Layover"
              min={facets.layoverMin}
              max={facets.layoverMax}
              valueMin={filters.layoverMin}
              valueMax={filters.layoverMax}
              format={DurationLabel}
              onChange={(min, max) => onChange({ ...filters, layoverMin: min, layoverMax: max })}
            />
          ) : null}
          {showPrice ? (
            <RangeSlider
              label="Price"
              min={facets.priceMin}
              max={facets.priceMax}
              valueMin={filters.priceMin}
              valueMax={filters.priceMax}
              format={(n) => formatPriceMinor(n, facets.currency)}
              onChange={(min, max) => onChange({ ...filters, priceMin: min, priceMax: max })}
            />
          ) : null}
        </div>
      </section>

      {facets.airlines.length > 1 ? (
        <section className="filter-section">
          <p className="filter-section__label">Airlines</p>
          <div className="filter-chip-row" role="group" aria-label="Airlines">
            {facets.airlines.map((airline) => {
              const active =
                filters.airlines.length === 0 || filters.airlines.includes(airline.code);
              return (
                <FilterChip
                  key={airline.code}
                  label={`${airline.label}`}
                  active={active}
                  onClick={() => {
                    const selected = new Set(filters.airlines);
                    if (filters.airlines.length === 0) {
                      for (const a of facets.airlines) selected.add(a.code);
                    }
                    if (selected.has(airline.code) && selected.size === 1) return;
                    if (selected.has(airline.code)) selected.delete(airline.code);
                    else selected.add(airline.code);
                    const next = [...selected];
                    onChange({
                      ...filters,
                      airlines: next.length === facets.airlines.length ? [] : next,
                    });
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {facets.cabins.length > 1 ? (
        <section className="filter-section">
          <p className="filter-section__label">Cabin</p>
          <div className="filter-chip-row" role="group" aria-label="Cabin">
            {facets.cabins.map((cabin) => {
              const active =
                filters.cabins.length === 0 || filters.cabins.includes(cabin.id);
              return (
                <FilterChip
                  key={cabin.id}
                  label={cabin.label}
                  active={active}
                  onClick={() => {
                    const selected = new Set(filters.cabins);
                    if (filters.cabins.length === 0) {
                      for (const c of facets.cabins) selected.add(c.id);
                    }
                    if (selected.has(cabin.id) && selected.size === 1) return;
                    if (selected.has(cabin.id)) selected.delete(cabin.id);
                    else selected.add(cabin.id);
                    const next = [...selected];
                    onChange({
                      ...filters,
                      cabins: next.length === facets.cabins.length ? [] : next,
                    });
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {facets.hasBaggageOptions ? (
        <section className="filter-section filter-section--last">
          <p className="filter-section__label">Baggage</p>
          <div className="filter-chip-row" role="group" aria-label="Baggage">
            <FilterChip
              label="Checked bag included"
              active={filters.requireCheckedBag}
              onClick={() =>
                onChange({ ...filters, requireCheckedBag: !filters.requireCheckedBag })
              }
            />
          </div>
        </section>
      ) : null}
    </aside>
  );
}

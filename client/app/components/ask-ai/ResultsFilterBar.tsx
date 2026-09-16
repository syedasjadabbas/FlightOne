"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import {
  formatMinutesLabel,
  formatPriceMinor,
  isAirportEnabled,
  toggleLegAirport,
  type SidebarFilterFacets,
  type SidebarFilterState,
} from "@/lib/ask-ai/sidebarFilters";
import {
  airlinesFilterLabel,
  cabinFilterLabel,
  durationFilterLabel,
  layoverFilterLabel,
  priceFilterLabel,
  stopsFilterLabel,
  timesFilterLabel,
} from "@/lib/ask-ai/filterBarLabels";
import { mergeSmartFilterPatch, parseSmartFilter } from "@/lib/ask-ai/smartFilterParse";
import { FilterGlyph } from "./ResultsVisual";
import { FilterPopover } from "./FilterPopover";import {
  airportsFilterActive,
  DurationLabel,
  FilterChip,
  LegRouteBadge,
  RangeSlider,
  stopsFilterActive,
  timesFilterActive,
} from "./filterUi";

type FilterId =
  | "smart"
  | "stops"
  | "airlines"
  | "times"
  | "airports"
  | "bags"
  | "duration"
  | "price"
  | "layover"
  | "cabin";

function FilterBarButton({
  label,
  filterId,
  active,
  expanded,
  disabled,
  onClick,
}: {
  label: string;
  filterId?: string;
  active?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded ?? false}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className={`results-filter-btn${active ? " results-filter-btn--active" : ""}${
        expanded ? " results-filter-btn--expanded" : ""
      }`}
    >
      {filterId ? <FilterGlyph id={filterId} /> : null}
      {label}
      {active ? <span className="results-filter-btn__dot" aria-hidden /> : null}
    </button>
  );
}

export function ResultsFilterBar({
  facets,
  filters,
  onChange,
  onSendSmartFilter,
  refreshing = false,
}: {
  facets: SidebarFilterFacets;
  filters: SidebarFilterState;
  onChange: (next: SidebarFilterState) => void;
  onSendSmartFilter?: (text: string) => void;
  refreshing?: boolean;
}) {
  const [openFilter, setOpenFilter] = useState<FilterId | null>(null);
  const [smartText, setSmartText] = useState("");
  const [smartHint, setSmartHint] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const showLayover = facets.layoverMax > facets.layoverMin;
  const showPrice = facets.priceMax > facets.priceMin;
  const showDuration = facets.durationMax > facets.durationMin;

  const stopOptions = useMemo(
    () =>
      [
        facets.hasNonstop ? { id: "nonstop" as const, label: "Nonstop" } : null,
        facets.hasOneStop ? { id: "one" as const, label: "1 stop" } : null,
        facets.hasTwoPlus ? { id: "twoPlus" as const, label: "2+ stops" } : null,
      ].filter(Boolean) as Array<{ id: "nonstop" | "one" | "twoPlus"; label: string }>,
    [facets],
  );

  const hasAirportOptions = facets.legs.some(
    (leg) => leg.depart.length > 1 || leg.arrive.length > 1,
  );

  function open(id: FilterId, event: MouseEvent<HTMLButtonElement>) {
    lastTriggerRef.current = event.currentTarget;
    setOpenFilter(id);
  }

  function close() {
    setOpenFilter(null);
  }

  function submitSmartFilter() {
    const trimmed = smartText.trim();
    if (!trimmed) return;
    const result = parseSmartFilter(trimmed, facets, filters);
    if (result.patch) {
      onChange(mergeSmartFilterPatch(filters, result.patch));
      setSmartHint(result.message ?? "Filters updated.");
    }
    if (result.needsAva && onSendSmartFilter) {
      onSendSmartFilter(trimmed);
      close();
      return;
    }
    setSmartText("");
    if (result.patch) close();
  }

  function clearTimes() {
    const takeoffRanges = { ...filters.takeoffRanges };
    const arrivalRanges = { ...(filters.arrivalRanges ?? {}) };
    for (const leg of facets.legs) {
      takeoffRanges[leg.legIndex] = { min: leg.takeoffMin, max: leg.takeoffMax };
      arrivalRanges[leg.legIndex] = { min: leg.arrivalMin, max: leg.arrivalMax };
    }
    onChange({ ...filters, takeoffRanges, arrivalRanges });
  }

  function clearAirports() {
    onChange({ ...filters, departAirports: {}, arriveAirports: {} });
  }

  function clearStops() {
    onChange({
      ...filters,
      stopsNonstop: facets.hasNonstop,
      stopsOne: facets.hasOneStop,
      stopsTwoPlus: facets.hasTwoPlus,
    });
  }

  const labels = useMemo(
    () => ({
      stops: stopsFilterLabel(filters, facets),
      airlines: airlinesFilterLabel(filters, facets),
      times: timesFilterLabel(filters, facets),
      price: priceFilterLabel(filters, facets),
      duration: durationFilterLabel(filters, facets),
      layover: layoverFilterLabel(filters, facets),
      cabin: cabinFilterLabel(filters, facets),
    }),
    [filters, facets],
  );

  return (
    <>
      <div
        className={`results-filter-bar${refreshing ? " results-filter-bar--refreshing" : ""}`}
        role="toolbar"
        aria-label="Result filters"
      >
        <div className="results-filter-bar__scroll">
          {onSendSmartFilter ? (
            <FilterBarButton
              label="Smart Filters"
              filterId="smart"
              expanded={openFilter === "smart"}
              onClick={(e) => open("smart", e)}
            />
          ) : null}
          {stopOptions.length > 0 ? (
            <FilterBarButton
              label={labels.stops}
              filterId="stops"
              active={stopsFilterActive(filters, facets)}
              expanded={openFilter === "stops"}
              onClick={(e) => open("stops", e)}
            />
          ) : null}
          {facets.airlines.length > 1 ? (
            <FilterBarButton
              label={labels.airlines}
              filterId="airlines"
              active={filters.airlines.length > 0}
              expanded={openFilter === "airlines"}
              onClick={(e) => open("airlines", e)}
            />
          ) : null}
          {facets.legs.length > 0 ? (
            <FilterBarButton
              label={labels.times}
              filterId="times"
              active={timesFilterActive(filters, facets)}
              expanded={openFilter === "times"}
              onClick={(e) => open("times", e)}
            />
          ) : null}
          {hasAirportOptions ? (
            <FilterBarButton
              label="Airports"
              active={airportsFilterActive(filters, facets)}
              expanded={openFilter === "airports"}
              onClick={(e) => open("airports", e)}
            />
          ) : null}
          {facets.hasBaggageOptions ? (
            <FilterBarButton
              label="Bags"
              active={filters.requireCheckedBag}
              expanded={openFilter === "bags"}
              onClick={(e) => open("bags", e)}
            />
          ) : null}
          {showDuration ? (
            <FilterBarButton
              label={labels.duration}
              filterId="duration"
              active={
                filters.durationMin > facets.durationMin ||
                filters.durationMax < facets.durationMax
              }
              expanded={openFilter === "duration"}
              onClick={(e) => open("duration", e)}
            />
          ) : null}
          {showPrice ? (
            <FilterBarButton
              label={labels.price}
              filterId="price"
              active={
                filters.priceMin > facets.priceMin || filters.priceMax < facets.priceMax
              }
              expanded={openFilter === "price"}
              onClick={(e) => open("price", e)}
            />
          ) : null}
          {showLayover ? (
            <FilterBarButton
              label={labels.layover}
              filterId="layover"
              active={
                filters.layoverMin > facets.layoverMin ||
                filters.layoverMax < facets.layoverMax
              }
              expanded={openFilter === "layover"}
              onClick={(e) => open("layover", e)}
            />
          ) : null}
          {facets.cabins.length > 1 ? (
            <FilterBarButton
              label={labels.cabin}
              filterId="cabin"
              active={filters.cabins.length > 0}
              expanded={openFilter === "cabin"}
              onClick={(e) => open("cabin", e)}
            />
          ) : null}
        </div>
      </div>

      <FilterPopover
        open={openFilter === "smart"}
        title="Smart Filters"
        onClose={close}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <p className="filter-popover-subtitle">Describe what you&apos;re looking for.</p>
        {smartHint ? <p className="filter-smart-hint">{smartHint}</p> : null}
        <textarea
          rows={3}
          value={smartText}
          onChange={(e) => setSmartText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitSmartFilter();
            }
          }}
          placeholder="Morning flights, avoid long layovers, under PKR 100k…"
          className="filter-smart-input"
        />
        <button
          type="button"
          onClick={submitSmartFilter}
          disabled={!smartText.trim()}
          className="filter-smart-apply mt-3"
        >
          Filter flights
        </button>
        {onSendSmartFilter ? (
          <p className="filter-popover-footnote mt-2 text-[11px] text-[var(--ink-faint)]">
            Unsupported refinements are sent to Ava automatically.
          </p>
        ) : null}
      </FilterPopover>

      <FilterPopover
        open={openFilter === "stops"}
        title="Stops"
        onClose={close}
        onClear={clearStops}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
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
      </FilterPopover>

      <FilterPopover
        open={openFilter === "airlines"}
        title="Airlines"
        onClose={close}
        onClear={() => onChange({ ...filters, airlines: [] })}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <div className="filter-chip-row" role="group" aria-label="Airlines">
          {facets.airlines.map((airline) => {
            const active =
              filters.airlines.length === 0 || filters.airlines.includes(airline.code);
            return (
              <FilterChip
                key={airline.code}
                label={`${airline.label} (${airline.count})`}
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
      </FilterPopover>

      <FilterPopover
        open={openFilter === "times"}
        title="Times"
        onClose={close}
        onClear={clearTimes}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        {facets.legs.map((leg) => (
          <section key={leg.legIndex} className="filter-leg filter-leg--popover">
            <LegRouteBadge label={leg.label} />
            <p className="filter-leg__sublabel">Departure</p>
            <RangeSlider
              label="Departure window"
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
            <p className="filter-leg__sublabel">Arrival</p>
            <RangeSlider
              label="Arrival window"
              min={leg.arrivalMin}
              max={leg.arrivalMax}
              valueMin={filters.arrivalRanges?.[leg.legIndex]?.min ?? leg.arrivalMin}
              valueMax={filters.arrivalRanges?.[leg.legIndex]?.max ?? leg.arrivalMax}
              format={formatMinutesLabel}
              onChange={(min, max) =>
                onChange({
                  ...filters,
                  arrivalRanges: {
                    ...(filters.arrivalRanges ?? {}),
                    [leg.legIndex]: { min, max },
                  },
                })
              }
            />
          </section>
        ))}
      </FilterPopover>

      <FilterPopover
        open={openFilter === "airports"}
        title="Airports"
        onClose={close}
        onClear={clearAirports}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        {facets.legs.map((leg) => (
          <section key={leg.legIndex} className="filter-leg filter-leg--popover">
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
          </section>
        ))}
      </FilterPopover>

      <FilterPopover
        open={openFilter === "bags"}
        title="Bags"
        onClose={close}
        onClear={() => onChange({ ...filters, requireCheckedBag: false })}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <div className="filter-chip-row" role="group" aria-label="Baggage">
          <FilterChip
            label="Checked bag included"
            active={filters.requireCheckedBag}
            onClick={() =>
              onChange({ ...filters, requireCheckedBag: !filters.requireCheckedBag })
            }
          />
        </div>
      </FilterPopover>

      <FilterPopover
        open={openFilter === "duration"}
        title="Duration"
        onClose={close}
        onClear={() =>
          onChange({
            ...filters,
            durationMin: facets.durationMin,
            durationMax: facets.durationMax,
          })
        }
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <RangeSlider
          label="Total duration"
          min={facets.durationMin}
          max={facets.durationMax}
          valueMin={filters.durationMin}
          valueMax={filters.durationMax}
          format={DurationLabel}
          onChange={(min, max) => onChange({ ...filters, durationMin: min, durationMax: max })}
        />
      </FilterPopover>

      <FilterPopover
        open={openFilter === "price"}
        title="Price"
        onClose={close}
        onClear={() =>
          onChange({ ...filters, priceMin: facets.priceMin, priceMax: facets.priceMax })
        }
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <RangeSlider
          label="Price range"
          min={facets.priceMin}
          max={facets.priceMax}
          valueMin={filters.priceMin}
          valueMax={filters.priceMax}
          format={(n) => formatPriceMinor(n, facets.currency)}
          onChange={(min, max) => onChange({ ...filters, priceMin: min, priceMax: max })}
        />
      </FilterPopover>

      <FilterPopover
        open={openFilter === "layover"}
        title="Layover"
        onClose={close}
        onClear={() =>
          onChange({
            ...filters,
            layoverMin: facets.layoverMin,
            layoverMax: facets.layoverMax,
          })
        }
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <RangeSlider
          label="Maximum layover"
          min={facets.layoverMin}
          max={facets.layoverMax}
          valueMin={filters.layoverMin}
          valueMax={filters.layoverMax}
          format={DurationLabel}
          onChange={(min, max) => onChange({ ...filters, layoverMin: min, layoverMax: max })}
        />
      </FilterPopover>

      <FilterPopover
        open={openFilter === "cabin"}
        title="Cabin"
        onClose={close}
        onClear={() => onChange({ ...filters, cabins: [] })}
        onDone={close}
        returnFocusRef={lastTriggerRef}
      >
        <div className="filter-chip-row" role="group" aria-label="Cabin">
          {facets.cabins.map((cabin) => {
            const active = filters.cabins.length === 0 || filters.cabins.includes(cabin.id);
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
      </FilterPopover>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import { filterByTab, type ResultsTab } from "@/lib/ask-ai/applyFilters";
import type {
  FilterPill,
  ResultsSortKey,
  SearchPhase,
  SearchResultsPanel,
} from "@/lib/ask-ai/types";
import { FilterPillBar } from "./FilterPillBar";
import { ItinerarySummaryCard } from "./ItinerarySummaryCard";
import { OfferRowCompact } from "./OfferRowCompact";
import { ResultsFilterBar } from "./ResultsFilterBar";
import { ResultsFilterSidebar } from "./ResultsFilterSidebar";
import {
  FlexibleDatesButton,
  NearbyAirportsButton,
  PriceCalendarStub,
  PriceInsightStub,
  TrackPriceButton,
} from "./ResultsTools";
import { ResultsRailSkeleton } from "./ResultsRailSkeleton";
import type { SidebarFilterFacets, SidebarFilterState } from "@/lib/ask-ai/sidebarFilters";
import { defaultSidebarFilters } from "@/lib/ask-ai/sidebarFilters";
import { enrichItineraryFares, formatFlightResultsCount } from "@/lib/ask-ai/enrichItineraryFares";
import { FlightListContinuation, ResultsMarketplace } from "./ResultsMarketplace";
import {
  LiveInventoryBadge,
  ResultsMetaLine,
  ResultsRoutePath,
  ResultsSortSegmented,
  resolveRouteIata,
} from "./ResultsVisual";
import { RouteEditorial } from "./RouteEditorial";
import { ResultsEmptyState as EmptyState } from "./ResultsEmptyState";
import {
  SAMPLE_MAX,
  TRIPS_SAMPLE_MAX,
  WORKSPACE_PAGE,
  WORKSPACE_PAGE_STEP,
  applySampleBadges,
  sortItineraries,
} from "./resultsRailSort";

const TABS: { id: ResultsTab; label: string }[] = [
  { id: "flights", label: "Flights" },
  { id: "trips", label: "Trips" },
];

const SORT_OPTIONS: { id: ResultsSortKey; label: string }[] = [
  { id: "angle", label: "Recommended" },
  { id: "price", label: "Cheapest" },
  { id: "duration", label: "Quickest" },
];

const MULTI_CITY_SORT_OPTIONS: { id: ResultsSortKey; label: string }[] = [
  { id: "price", label: "Cheapest" },
  { id: "angle", label: "Recommended" },
  { id: "duration", label: "Quickest" },
];

export function ResultsRail({
  panel,
  offers,
  itineraries: filteredItineraries,
  busy,
  searchPhase,
  filterPills,
  sidebarFilters,
  sidebarFacets,
  sortKey,
  activeOriginIdx,
  onOriginChange,
  onTogglePill,
  onSidebarFiltersChange,
  onClearSidebarFilters,
  onSortChange,
  onViewOffer,
  onViewTrip,
  onSendFilter,
  onTripTitleChange,
  onClose,
  workspace = false,
  contentScrollRef,
  conversationId,
}: {
  panel: SearchResultsPanel | null;
  offers: OfferCard[];
  itineraries?: ItinerarySummary[];
  busy: boolean;
  searchPhase: SearchPhase;
  filterPills: FilterPill[];
  sidebarFilters?: SidebarFilterState | null;
  sidebarFacets?: SidebarFilterFacets | null;
  sortKey: ResultsSortKey;
  activeOriginIdx?: number;
  onOriginChange?: (idx: number) => void;
  onTogglePill: (pillId: string) => void;
  onSidebarFiltersChange?: (next: SidebarFilterState) => void;
  onClearSidebarFilters?: () => void;
  onSortChange: (sort: ResultsSortKey) => void;
  onViewOffer: (offer: OfferCard) => void;
  onViewTrip?: (itinerary: ItinerarySummary) => void;
  onSendFilter?: (text: string) => void;
  onTripTitleChange?: (title: string) => void;
  /** Return to chat from the results workspace. */
  onClose?: () => void;
  /** Full-page results workspace — show the full list, not a short sample. */
  workspace?: boolean;
  /** Scroll container for the right-hand results pane (workspace only). */
  contentScrollRef?: RefObject<HTMLDivElement | null>;
  /** Optional conversation id for Module 04 feedback attribution. */
  conversationId?: string | null;
}) {
  const [tab, setTab] = useState<ResultsTab>("flights");
  const [expanded, setExpanded] = useState(workspace);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [workspaceLimit, setWorkspaceLimit] = useState(WORKSPACE_PAGE);

  const apiSearching = busy && searchPhase === "search";
  const hasResults =
    (panel?.itineraries?.length ?? 0) > 0 ||
    (panel?.offers?.length ?? 0) > 0 ||
    offers.length > 0;
  const showSkeleton = apiSearching && !hasResults;
  const visible = panel != null || apiSearching;

  const originVariants = panel?.originVariants ?? [];
  const originIdx = activeOriginIdx ?? 0;
  const activeVariant = originVariants[originIdx];

  const tabbedOffers = useMemo(() => {
    const filtered = filterByTab(offers, tab);
    // If Flights tab would wipe a non-empty list (missing/odd type tags), still show flight-shaped cards.
    const base =
      tab === "flights" && filtered.length === 0 && offers.length > 0
        ? offers.filter((o) => o.type === "flight" || Boolean(o.flight))
        : filtered;
    const flightish = base.some((o) => o.type === "flight" || o.flight);
    return flightish ? enrichItineraryFares(base) : base;
  }, [offers, tab]);
  const rawItineraryCount = panel?.itineraries?.length ?? 0;
  const itineraries = filteredItineraries ?? panel?.itineraries ?? [];
  const multiCity = Boolean(panel?.multiCity);
  const useTripSortUi = tab === "trips" || multiCity;
  const showSidebar =
    Boolean(sidebarFacets && sidebarFilters && onSidebarFiltersChange) && !showSkeleton;

  const sortedItineraries = useMemo(
    () => sortItineraries(itineraries, sortKey),
    [itineraries, sortKey],
  );

  const badgedOffers = useMemo(() => applySampleBadges(tabbedOffers), [tabbedOffers]);
  const totalForSeeAll = activeVariant?.totalCount ?? panel?.totalCount ?? tabbedOffers.length;

  useEffect(() => {
    setExpanded(workspace);
    setWorkspaceLimit(WORKSPACE_PAGE);
  }, [panel?.legRoute, panel?.tripTitle, originIdx, tab, workspace, sortKey, offers.length]);

  useEffect(() => {
    if (panel?.tripTitle) setTitleDraft(panel.tripTitle);
  }, [panel?.tripTitle]);

  useEffect(() => {
    if (panel?.multiCity && (panel.itineraries?.length ?? 0) > 0) {
      setTab("trips");
    }
  }, [panel]);

  if (!visible) return null;

  const emptyMessage =
    activeVariant?.emptyMessage ||
    panel?.emptyHint ||
    (panel?.multiCity
      ? "Try changing your dates, destination, stops, or departure time."
      : "Try changing your dates, destination, stops, or departure time.");

  function commitTitle() {
    const next = titleDraft.trim();
    if (next && next !== panel?.tripTitle) onTripTitleChange?.(next);
    setEditingTitle(false);
  }

  const isTripsView = tab === "trips" || (multiCity && rawItineraryCount > 0);
  const showFullList = workspace || expanded;
  const displayItineraries = showFullList
    ? sortedItineraries
    : sortedItineraries.slice(0, TRIPS_SAMPLE_MAX);
  const flightTotal = badgedOffers.length;
  const displayOffers = workspace
    ? badgedOffers.slice(0, workspaceLimit)
    : showFullList
      ? badgedOffers
      : badgedOffers.slice(0, SAMPLE_MAX);
  const canLoadMoreFlights = workspace && tab !== "trips" && flightTotal > workspaceLimit;
  const flightsExhausted =
    workspace && tab !== "trips" && flightTotal > 0 && workspaceLimit >= flightTotal;
  const showSeeAllTrips =
    !workspace && tab === "trips" && !showFullList && sortedItineraries.length > TRIPS_SAMPLE_MAX;
  const showSeeAll =
    !workspace &&
    tab !== "trips" &&
    !showFullList &&
    tabbedOffers.length > SAMPLE_MAX &&
    totalForSeeAll > SAMPLE_MAX;

  const visibleCount =
    tab === "trips" ? sortedItineraries.length : tabbedOffers.length;
  const inventoryTotal =
    tab === "trips"
      ? rawItineraryCount
      : (activeVariant?.totalCount ?? panel?.totalCount ?? tabbedOffers.length);
  const countLabel =
    tab === "trips"
      ? `${visibleCount}${rawItineraryCount !== visibleCount ? ` of ${rawItineraryCount}` : ""} ${visibleCount === 1 ? "trip" : "trips"}`
      : formatFlightResultsCount(tabbedOffers, inventoryTotal);

  const cabinLabel =
    panel?.cabin === "business"
      ? "Business"
      : panel?.cabin === "premium"
        ? "Premium Economy"
        : panel?.cabin === "economy"
          ? "Economy"
          : null;
  const passengersLabel =
    panel?.passengers != null && panel.passengers > 0
      ? `${panel.passengers} ${panel.passengers === 1 ? "traveller" : "travellers"}`
      : null;

  const routeIata = useMemo(
    () => resolveRouteIata(panel, offers),
    [panel, offers],
  );

  const canClearFilters = Boolean(sidebarFacets && sidebarFilters && onSidebarFiltersChange);
  const clearFilters = () => {
    if (!sidebarFacets || !onSidebarFiltersChange) return;
    (onClearSidebarFilters ?? (() => onSidebarFiltersChange(defaultSidebarFilters(sidebarFacets))))();
  };
  const askAvaToBroaden = () => {
    onSendFilter?.("Clear all filters and broaden the search — show more flight options");
    onClose?.();
  };
  const askNearbyAirports = onSendFilter
    ? () => onSendFilter("Include nearby airports in this search")
    : undefined;

  const routeHeadline =
    panel?.legRoute ??
    panel?.queryLabel ??
    (panel?.tripTitle && !editingTitle ? panel.tripTitle : null);

  const filterSidebar =
    showSidebar && sidebarFacets && sidebarFilters && onSidebarFiltersChange ? (
      <ResultsFilterSidebar
        facets={sidebarFacets}
        filters={sidebarFilters}
        onChange={onSidebarFiltersChange}
        onSendSmartFilter={
          onSendFilter
            ? (text) => {
                onSendFilter(text);
                if (workspace) onClose?.();
              }
            : undefined
        }
        onClear={
          onClearSidebarFilters ?? (() => onSidebarFiltersChange(defaultSidebarFilters(sidebarFacets)))
        }
      />
    ) : null;

  const tabsAndSort = (
    <div className="results-rail__tabs-sort">
      <div className="results-rail__tabs" role="tablist" aria-label="Result type">
        {TABS.map((t) => {
          const count =
            t.id === "trips"
              ? rawItineraryCount
              : filterByTab(offers, "flights").length;
          if (t.id === "trips" && count === 0 && !multiCity && !apiSearching) return null;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`results-tab${tab === t.id ? " results-tab--active" : ""}`}
            >
              {t.label}
              {count > 0 ? (
                <span className="results-tab__count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ResultsSortSegmented
        options={useTripSortUi ? MULTI_CITY_SORT_OPTIONS : SORT_OPTIONS}
        value={sortKey}
        onChange={onSortChange}
      />
    </div>
  );

  const resultsList = showSkeleton ? (
    <ResultsRailSkeleton
      rows={workspace ? 6 : 4}
      originCode={routeIata?.origin}
      destCode={routeIata?.dest}
    />
  ) : tab === "trips" ? (
    sortedItineraries.length > 0 ? (
      <div className="trip-card-list w-full space-y-3">
        {displayItineraries.map((it, i) => (
          <ItinerarySummaryCard key={it.id} itinerary={it} index={i} onSelect={onViewTrip} />
        ))}
        {showSeeAllTrips ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em] text-[var(--signal)] hover:bg-[var(--mist)]"
          >
            See all {sortedItineraries.length} trips
          </button>
        ) : null}
        {expanded && !workspace && sortedItineraries.length > TRIPS_SAMPLE_MAX ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full py-1 text-center text-[12px] font-medium text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
          >
            Show top {TRIPS_SAMPLE_MAX}
          </button>
        ) : null}
      </div>
    ) : (
      <EmptyState
        title="No trips found"
        message="Try changing your dates, destination, stops, or departure time."
        onClearFilters={canClearFilters ? clearFilters : undefined}
        onAskAva={onSendFilter && onClose ? askAvaToBroaden : undefined}
        onNearbyAirports={askNearbyAirports}
      />
    )
  ) : tabbedOffers.length > 0 ? (
    <div className="results-flight-list">
      {displayOffers.map((offer, i) => (
        <OfferRowCompact
          key={offer.id}
          offer={offer}
          index={i}
          onViewOffer={onViewOffer}
          conversationId={conversationId}
        />
      ))}
      {workspace ? (
        <FlightListContinuation
          shown={displayOffers.length}
          total={flightTotal}
          exhausted={flightsExhausted}
          onLoadMore={
            canLoadMoreFlights
              ? () => setWorkspaceLimit((n) => Math.min(flightTotal, n + WORKSPACE_PAGE_STEP))
              : undefined
          }
        />
      ) : null}
      {showSeeAll ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-center text-[13px] font-semibold tracking-[-0.01em] text-[var(--signal)] hover:bg-[var(--mist)]"
        >
          See all {totalForSeeAll} {tab === "flights" || tab === "all" ? "flights" : "options"}
        </button>
      ) : null}
      {expanded && !workspace && tabbedOffers.length > SAMPLE_MAX ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full py-1 text-center text-[12px] font-medium text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
        >
          Show top {SAMPLE_MAX}
        </button>
      ) : null}
    </div>
  ) : panel?.legPanels && panel.legPanels.length > 0 ? (
    <div className="space-y-4">
      {panel.legPanels.map((leg) => (
        <section key={leg.legRoute} className="rounded-xl border border-[var(--line)] bg-white p-3">
          <header className="mb-2">
            {leg.stageLabel ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--signal)]">
                {leg.stageLabel}
              </p>
            ) : null}
            <p className="font-mono text-[12px] font-medium text-[var(--ink)]">
              Flights {leg.legRoute}
            </p>
            <p className="text-[11px] text-[var(--ink-faint)]">
              {leg.totalCount > 0
                ? `${leg.totalCount} ${leg.live ? "live GDS" : ""} fare${leg.totalCount === 1 ? "" : "s"}`
                : leg.emptyMessage || "No GDS inventory"}
            </p>
          </header>
          {leg.offers.length > 0 ? (
            <div className="space-y-2">
              {leg.offers.map((offer, i) => (
                <OfferRowCompact
                  key={offer.id}
                  offer={offer}
                  index={i}
                  onViewOffer={onViewOffer}
                  conversationId={conversationId}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--ink-soft)]">
              {leg.emptyMessage || "No fares on these dates."}
            </p>
          )}
        </section>
      ))}
    </div>
  ) : panel ? (
    <EmptyState
      title={
        rawItineraryCount > 0 || (panel.totalCount ?? 0) > 0
          ? "No flights match these filters"
          : "No live flights found"
      }
      message={
        rawItineraryCount > 0 || (panel.totalCount ?? 0) > 0
          ? "No flights match your current filters. Try clearing filters or adjusting your criteria."
          : emptyMessage
      }
      filtered={rawItineraryCount > 0 || (panel.totalCount ?? 0) > 0}
      onClearFilters={
        canClearFilters && (rawItineraryCount > 0 || (panel.totalCount ?? 0) > 0)
          ? clearFilters
          : undefined
      }
      onAskAva={onSendFilter && onClose ? askAvaToBroaden : undefined}
      onNearbyAirports={askNearbyAirports}
    />
  ) : null;

  if (workspace) {
    const routeLine =
      panel?.legRoute ??
      panel?.queryLabel ??
      panel?.tripTitle ??
      routeHeadline;
    const sortOptions = useTripSortUi ? MULTI_CITY_SORT_OPTIONS : SORT_OPTIONS;

    return (
      <div className="results-page" aria-label="Live search results">
        <div className="results-shell">
          <aside className="results-sidebar" aria-label="Search summary and filters">
            <div className="results-sidebar__inner">
              <header className="results-summary results-summary--sidebar">
                <div className="results-summary__nav">
                  <button type="button" onClick={onClose} className="results-back-link">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M15 6 9 12l6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back to chat
                  </button>
                  {onClose ? (
                    <button type="button" onClick={onClose} className="results-refine-btn">
                      Refine with Ava
                    </button>
                  ) : null}
                </div>

                <div className="results-summary__route">
                  {tab !== "trips" && routeLine && !panel?.tripTitle && !editingTitle ? (
                    <p className="results-eyebrow">
                      Live flights
                      <LiveInventoryBadge updating={busy && searchPhase === "search"} />
                    </p>
                  ) : null}
                  {panel?.tripTitle || editingTitle ? (
                    editingTitle ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitTitle();
                          if (e.key === "Escape") {
                            setTitleDraft(panel?.tripTitle ?? "");
                            setEditingTitle(false);
                          }
                        }}
                        className="results-title-input"
                        aria-label="Edit trip title"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTitleDraft(panel?.tripTitle ?? "");
                          setEditingTitle(true);
                        }}
                        className="results-route-headline results-route-headline--button"
                        title="Click to rename"
                      >
                        {panel?.tripTitle}
                      </button>
                    )
                  ) : routeLine ? (
                    <RouteEditorial route={routeLine} />
                  ) : null}
                  <ResultsMetaLine
                    dateSpan={panel?.dateSpan}
                    passengers={passengersLabel}
                    cabin={cabinLabel}
                  />
                  {routeIata && tab !== "trips" ? (
                    <ResultsRoutePath originCode={routeIata.origin} destCode={routeIata.dest} />
                  ) : null}
                </div>

                {originVariants.length > 1 ? (
                  <div className="results-origin-tabs" role="tablist" aria-label="Origin comparison">
                    {originVariants.map((v, i) => (
                      <button
                        key={v.originIata}
                        type="button"
                        role="tab"
                        aria-selected={originIdx === i}
                        onClick={() => onOriginChange?.(i)}
                        className={`results-origin-tab${originIdx === i ? " results-origin-tab--active" : ""}`}
                      >
                        {v.originLabel}
                        <span className="tabular-nums opacity-75">{v.totalCount}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="results-summary__chips">
                  <FilterPillBar
                    pills={filterPills}
                    onTogglePill={onTogglePill}
                    onSendFilter={onSendFilter}
                  />
                </div>
                <div className="results-summary__tools">
                  <FlexibleDatesButton
                    onFlexible={
                      onSendFilter
                        ? () => onSendFilter("Search flexible dates ±3 days for this route")
                        : undefined
                    }
                  />
                  <NearbyAirportsButton
                    onBroaden={
                      onSendFilter
                        ? () => onSendFilter("Include nearby airports in this search")
                        : undefined
                    }
                  />
                  <TrackPriceButton onTrack={() => onClose?.()} />
                </div>

                <PriceCalendarStub
                  dateSpan={panel?.dateSpan}
                  onAskFlexible={
                    onSendFilter
                      ? () => onSendFilter("Search flexible dates ±3 days for this route")
                      : undefined
                  }
                />
                <PriceInsightStub />
              </header>

              {filterSidebar ? (
                <div className="results-sidebar__filters results-sidebar__filters--desktop">
                  {filterSidebar}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="results-content" ref={contentScrollRef}>
            <div className="results-content__sticky">
              {showSidebar && sidebarFacets && sidebarFilters && onSidebarFiltersChange ? (
                <ResultsFilterBar
                  facets={sidebarFacets}
                  filters={sidebarFilters}
                  onChange={onSidebarFiltersChange}
                  refreshing={busy && searchPhase === "search"}
                  onSendSmartFilter={
                    onSendFilter
                      ? (text) => {
                          onSendFilter(text);
                        }
                      : undefined
                  }
                />
              ) : null}

              <div className="results-toolbar">
                <div className="results-toolbar__left">
                  {TABS.map((t) => {
                    const count =
                      t.id === "trips"
                        ? rawItineraryCount
                        : filterByTab(offers, "flights").length;
                    if (t.id === "trips" && count === 0 && !multiCity && !apiSearching) return null;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`results-tab${tab === t.id ? " results-tab--active" : ""}`}
                      >
                        {t.label}
                        {count > 0 ? <span className="results-tab__count">{count}</span> : null}
                      </button>
                    );
                  })}
                  {panel && !showSkeleton ? (
                    <p className="results-count">
                      {countLabel}
                      {tab !== "trips" ? (
                        <span className="results-count__source"> · prices from Travelport</span>
                      ) : null}
                      {busy && searchPhase === "search" ? (
                        <span className="results-count__updating"> · Updating…</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>

                <ResultsSortSegmented options={sortOptions} value={sortKey} onChange={onSortChange} />
              </div>
            </div>

            <main className="results-list">
              {apiSearching && hasResults ? (
                <p className="results-search-status" role="status">
                  Searching live fares…
                </p>
              ) : null}
              {resultsList}
              {!showSkeleton && hasResults ? (
                <ResultsMarketplace
                  panel={panel}
                  offers={panel?.offers?.length ? panel.offers : offers}
                  onSendFilter={onSendFilter}
                  onViewOffer={onViewOffer}
                  onClose={onClose}
                />
              ) : null}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`results-rail flex h-full min-h-0 w-full flex-col bg-[var(--fo-surface-raised)] ${
        isTripsView ? "results-rail--trips" : ""
      } ${showSidebar ? "results-rail--filtered" : ""}`}
      aria-label="Live search results"
    >
      <header className="shrink-0 space-y-3 border-b border-[var(--line)] bg-[var(--light)]/50 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="results-rail__eyebrow">Live results</p>
            {panel?.tripTitle || editingTitle ? (
              editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(panel?.tripTitle ?? "");
                      setEditingTitle(false);
                    }
                  }}
                  className="mt-0.5 w-full rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[14px] font-semibold tracking-[-0.02em] text-[var(--ink)] outline-none focus:border-[var(--signal)]"
                  aria-label="Edit trip title"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(panel?.tripTitle ?? "");
                    setEditingTitle(true);
                  }}
                  className="mt-0.5 block w-full truncate text-left text-[14px] font-semibold tracking-[-0.02em] text-[var(--ink)] hover:text-[var(--signal)]"
                  title="Click to rename"
                >
                  {panel?.tripTitle}
                </button>
              )
            ) : null}
            {panel?.dateSpan ? (
              <p className="mt-0.5 text-[12px] font-medium text-[var(--ink-soft)]">{panel.dateSpan}</p>
            ) : null}
            {panel?.legRoute ? (
              <p className="mt-1 truncate font-mono text-[11px] tracking-tight text-[var(--ink-faint)]">
                {panel.legRoute}
              </p>
            ) : panel?.queryLabel ? (
              <p className="mt-0.5 truncate text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)]">
                {panel.queryLabel}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {panel?.liveFlights ? (
              <LiveInventoryBadge />
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink-soft)] transition-colors hover:border-[var(--sky)] hover:text-[var(--sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/35"
                aria-label="Back to chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {originVariants.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Origin comparison">
            {originVariants.map((v, i) => (
              <button
                key={v.originIata}
                type="button"
                role="tab"
                aria-selected={originIdx === i}
                onClick={() => onOriginChange?.(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  originIdx === i
                    ? "bg-[color-mix(in_oklab,var(--sky)_14%,white)] text-[var(--sky)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--light)] hover:text-[var(--ink)]"
                }`}
              >
                {v.originLabel}
                <span className="ml-1 tabular-nums text-[10px] opacity-75">{v.totalCount}</span>
              </button>
            ))}
          </div>
        ) : null}

        <FilterPillBar pills={filterPills} onTogglePill={onTogglePill} onSendFilter={onSendFilter} />
        {tabsAndSort}

        {panel && !showSkeleton ? (
          <p className="text-[11px] text-[var(--ink-faint)]">
            {countLabel}
            {tab !== "trips" ? " · prices from Travelport" : null}
          </p>
        ) : showSkeleton ? (
          <p className="text-[12px] font-medium text-[var(--sky)]">
            Searching live fares…
          </p>
        ) : null}
      </header>

      <div className="results-rail-body flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {filterSidebar ? (
          <div className="results-rail-sidebar-scroll hidden w-[252px] shrink-0 border-r border-[var(--line)] bg-[var(--light)]/30 sm:block xl:w-[272px]">
            {filterSidebar}
          </div>
        ) : null}
        <div className="results-rail-scroll px-3 py-3 sm:px-4">
          {resultsList}
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import type {
  FilterPill,
  ResultsSortKey,
  SearchPhase,
  SearchResultsPanel,
} from "@/lib/ask-ai/types";
import type { SidebarFilterFacets, SidebarFilterState } from "@/lib/ask-ai/sidebarFilters";
import { FlightOfferDetailModal } from "../FlightOfferDetailModal";
import { TripDetailModal } from "../TripDetailModal";
import { ResultsRail } from "./ResultsRail";

export type AskAiView = "chat" | "results";

/**
 * Two full-screen workspaces: Chat and Results.
 * Both stay mounted so conversation + search state are preserved when switching.
 *
 * Results: fixed left search sidebar + single scrollable right content pane
 * (no page-level scrolling of the results workspace).
 */
export function AskAiShell({
  chat,
  panel,
  displayedOffers,
  busy,
  searchPhase,
  filterPills,
  sortKey,
  activeOriginIdx,
  onOriginChange,
  onTogglePill,
  onSortChange,
  onSendFilter,
  onBookOffer,
  onBookTrip,
  onTripTitleChange,
  displayedItineraries,
  sidebarFilters,
  sidebarFacets,
  onSidebarFiltersChange,
  onClearSidebarFilters,
  view: viewControlled,
  onViewChange,
  resultsWorkspaceAvailable,
  conversationId,
}: {
  chat: ReactNode;
  panel: SearchResultsPanel | null;
  displayedOffers: OfferCard[];
  displayedItineraries?: ItinerarySummary[];
  sidebarFilters?: SidebarFilterState | null;
  sidebarFacets?: SidebarFilterFacets | null;
  onSidebarFiltersChange?: (next: SidebarFilterState) => void;
  onClearSidebarFilters?: () => void;
  busy: boolean;
  searchPhase: SearchPhase;
  filterPills: FilterPill[];
  sortKey: ResultsSortKey;
  activeOriginIdx?: number;
  onOriginChange?: (idx: number) => void;
  onTogglePill: (pillId: string) => void;
  onSortChange: (sort: ResultsSortKey) => void;
  onSendFilter?: (text: string) => void;
  onBookOffer?: (offer: OfferCard) => void;
  onBookTrip?: (itinerary: ItinerarySummary) => void;
  onTripTitleChange?: (title: string) => void;
  view?: AskAiView;
  onViewChange?: (view: AskAiView) => void;
  /** Live search with inventory (or in-flight search) — not clarify / empty panels. */
  resultsWorkspaceAvailable?: boolean;
  /** Module 04 feedback attribution (optional). */
  conversationId?: string | null;
}) {
  const [detailOffer, setDetailOffer] = useState<OfferCard | null>(null);
  const [detailTrip, setDetailTrip] = useState<ItinerarySummary | null>(null);
  const [viewUncontrolled, setViewUncontrolled] = useState<AskAiView>("chat");
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const isControlled = viewControlled !== undefined;
  const view = isControlled ? viewControlled : viewUncontrolled;

  function setView(next: AskAiView) {
    if (!isControlled) setViewUncontrolled(next);
    onViewChange?.(next);
  }

  const resultsAvailable = resultsWorkspaceAvailable ?? false;

  useEffect(() => {
    if (view === "results" && !resultsAvailable) {
      setView("chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, resultsAvailable]);

  useEffect(() => {
    const root = document.documentElement;
    const on = view === "results" && resultsAvailable;
    root.classList.toggle("fo-results-active", on);
    document.body.classList.toggle("fo-results-active", on);
    return () => {
      root.classList.remove("fo-results-active");
      document.body.classList.remove("fo-results-active");
    };
  }, [view, resultsAvailable]);

  useEffect(() => {
    if (view !== "results") return;
    contentScrollRef.current?.scrollTo({ top: 0 });
  }, [view, panel?.legRoute, panel?.tripTitle]);

  function goToChat() {
    setView("chat");
  }

  function handleBookOffer(offer: OfferCard) {
    onBookOffer?.(offer);
  }

  function handleBookTrip(itinerary: ItinerarySummary) {
    onBookTrip?.(itinerary);
  }

  return (
    <div
      className={
        view === "results"
          ? "ask-ai-shell ask-ai-shell--results relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
          : "ask-ai-shell ask-ai-shell--chat relative flex min-h-0 w-full flex-col"
      }
    >
      <div
        className={
          view === "chat"
            ? "ask-ai-shell__chat-pane flex min-h-0 min-w-0 flex-col"
            : "hidden"
        }
        aria-hidden={view !== "chat"}
      >
        {chat}
      </div>

      {resultsAvailable ? (
        <div
          className={
            view === "results"
              ? "results-page-host flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
          aria-hidden={view !== "results"}
        >
          <ResultsRail
            panel={panel}
            offers={displayedOffers}
            itineraries={displayedItineraries}
            busy={busy}
            searchPhase={searchPhase}
            filterPills={filterPills}
            sidebarFilters={sidebarFilters}
            sidebarFacets={sidebarFacets}
            sortKey={sortKey}
            activeOriginIdx={activeOriginIdx}
            onOriginChange={onOriginChange}
            onTogglePill={onTogglePill}
            onSidebarFiltersChange={onSidebarFiltersChange}
            onClearSidebarFilters={onClearSidebarFilters}
            onSortChange={onSortChange}
            onViewOffer={setDetailOffer}
            onViewTrip={setDetailTrip}
            onSendFilter={onSendFilter}
            onTripTitleChange={onTripTitleChange}
            onClose={goToChat}
            workspace
            contentScrollRef={contentScrollRef}
            conversationId={conversationId}
          />
        </div>
      ) : null}

      {detailOffer?.type === "flight" && detailOffer.flight ? (
        <FlightOfferDetailModal
          offer={detailOffer}
          onClose={() => setDetailOffer(null)}
          onBook={() => {
            handleBookOffer(detailOffer);
            setDetailOffer(null);
          }}
        />
      ) : null}

      {detailTrip ? (
        <TripDetailModal
          itinerary={detailTrip}
          onClose={() => setDetailTrip(null)}
          onBook={() => {
            handleBookTrip(detailTrip);
            setDetailTrip(null);
          }}
        />
      ) : null}
    </div>
  );
}

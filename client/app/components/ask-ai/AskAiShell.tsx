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

/** Result of a book attempt — `navigating` means a page redirect is under way. */
export type BookOfferOutcome = { navigating: boolean };

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
  /**
   * May be async — the detail modal holds its pending state until it settles.
   * Resolve `{ navigating: true }` when a full-page redirect has been started,
   * so the modal stays mounted instead of repainting the screen behind it.
   */
  onBookOffer?: (
    offer: OfferCard,
  ) => BookOfferOutcome | void | Promise<BookOfferOutcome | void>;
  onBookTrip?: (
    itinerary: ItinerarySummary,
  ) => BookOfferOutcome | void | Promise<BookOfferOutcome | void>;
  onTripTitleChange?: (title: string) => void;
  view?: AskAiView;
  onViewChange?: (view: AskAiView) => void;
  /** Live search with inventory (or in-flight search) — not clarify / empty panels. */
  resultsWorkspaceAvailable?: boolean;
  /** Module 04 feedback attribution (optional). */
  conversationId?: string | null;
}) {
  const [detailOffer, setDetailOffer] = useState<OfferCard | null>(null);
  /** True while a quote is in flight, so the detail modal holds instead of closing. */
  const [booking, setBooking] = useState(false);
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
    return onBookOffer?.(offer);
  }

  function handleBookTrip(itinerary: ItinerarySummary) {
    return onBookTrip?.(itinerary);
  }

  function handleViewOffer(offer: OfferCard) {
    setDetailOffer(offer);
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
            onViewOffer={handleViewOffer}
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
          booking={booking}
          onClose={() => setDetailOffer(null)}
          onBook={() => {
            // Stay open while the quote is in flight. Closing here dropped the
            // traveller onto the chat view for the ~1-2s the quote took, which
            // looked like "View Deal goes back to chat" before checkout opened.
            setBooking(true);
            // Close ONLY on failure. `window.location.href` schedules the
            // navigation and returns immediately, so tearing the modal down in
            // a `.finally()` un-mounts it while the browser is still on this
            // page — that repaint is the flash of the results screen.
            void Promise.resolve(handleBookOffer(detailOffer)).then(
              (outcome) => {
                if (outcome?.navigating) return;
                setBooking(false);
                setDetailOffer(null);
              },
              () => {
                setBooking(false);
                setDetailOffer(null);
              },
            );
          }}
        />
      ) : null}

      {detailTrip ? (
        <TripDetailModal
          itinerary={detailTrip}
          booking={booking}
          onClose={() => setDetailTrip(null)}
          onBook={() => {
            // Same teardown rule as the single-offer modal: hold while the
            // quote is in flight, and close ONLY when we are not navigating.
            setBooking(true);
            void Promise.resolve(handleBookTrip(detailTrip)).then(
              (outcome) => {
                if (outcome?.navigating) return;
                setBooking(false);
                setDetailTrip(null);
              },
              () => {
                setBooking(false);
                setDetailTrip(null);
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}

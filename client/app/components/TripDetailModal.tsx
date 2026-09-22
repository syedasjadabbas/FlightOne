"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { ItinerarySummary } from "@/lib/consultant/types";
import { formatDurationLabel } from "./flightOfferFormat";
import { TripLegDetailCard } from "./trip/TripLegDetailCard";

const ANGLE_LABEL: Record<string, string> = {
  best_value: "Best",
  cheapest: "Cheapest",
  fastest: "Fastest",
  premium: "Premium",
  top_rated: "Top rated",
  recommended: "Recommended",
};

function FarePanel({
  itinerary,
  onBook,
  className = "",
}: {
  itinerary: ItinerarySummary;
  onBook: () => void;
  className?: string;
}) {
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const hasMarketReference =
    itinerary.hasMarketReferenceLeg ||
    (itinerary.legs?.some((leg) => leg.marketReference) ?? false);
  const parts = itinerary.totalPrice.trim().split(/\s+/);
  const code = parts.length > 1 ? parts[0] : itinerary.currency;
  const amount = parts.length > 1 ? parts.slice(1).join(" ") : itinerary.totalPrice;
  const totalDuration =
    itinerary.legs?.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0) ?? 0;

  return (
    <aside
      className={`rounded-2xl border border-transparent bg-white p-5 ${className}`}
      style={{
        boxShadow: "var(--shadow-soft), inset 0 1px 0 #ffffff",
        backgroundImage:
          "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--signal) 10%, transparent), transparent 55%)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
        Complete trip
      </p>
      <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
        {isMultiTicket ? "Self-transfer · separate tickets" : "Single ticket"}
        {totalDuration > 0 ? ` · ${formatDurationLabel(totalDuration, "long")} total` : ""}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {code}
      </p>
      <p className="offer-price text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--ink)]">
        {amount}
      </p>

      {isMultiTicket ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
          You change planes or airports between tickets. Allow extra time for immigration,
          baggage reclaim, and check-in.
        </p>
      ) : null}

      {hasMarketReference ? (
        <p className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[12px] leading-relaxed text-sky-800">
          Some legs are Google Flights market estimates — not bookable through FlightOne. Use
          Continue booking only for GDS-priced segments.
        </p>
      ) : null}

      {itinerary.reasons.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-4">
          {itinerary.reasons.map((r) => (
            <li
              key={r}
              className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--ink-soft)]"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--signal)]" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onBook}
        disabled={hasMarketReference}
        className="book-btn mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--sky-solid)] px-5 py-3.5 text-[15px] font-semibold tracking-[-0.01em] text-white shadow-[0_4px_14px_rgba(8,150,191,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--electric)_90%,var(--navy))] hover:shadow-[0_8px_22px_rgba(0,122,229,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        {hasMarketReference ? "Market reference only" : "Continue booking"}
        {!hasMarketReference ? <span aria-hidden>→</span> : null}
      </button>
    </aside>
  );
}

export function TripDetailModal({
  itinerary,
  onClose,
  onBook,
}: {
  itinerary: ItinerarySummary;
  onClose: () => void;
  onBook: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const legs = itinerary.legs ?? [];
  const angle = ANGLE_LABEL[itinerary.angle] ?? itinerary.angle;
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const routeLabel = legs.length
    ? legs.map((l) => `${l.originCode}→${l.destinationCode}`).join(" · ")
    : itinerary.hops.join(" → ");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fo-detail-page fixed inset-0 z-[100] flex h-[100dvh] w-full flex-col text-[var(--ink)]"
    >
      <header className="fo-detail-page__header shrink-0 pt-[max(0.65rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 pb-4 sm:px-8">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] shadow-[0_2px_8px_rgba(14,22,32,0.05),inset_0_1px_0_#ffffff] transition-all hover:-translate-y-px hover:text-[var(--signal)] hover:shadow-[0_4px_12px_rgba(14,22,32,0.08),inset_0_1px_0_#ffffff]"
            aria-label="Back to trips"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 6 9 12l6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={titleId}
                className="text-[1.25rem] font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-[1.5rem]"
              >
                Complete trip
              </h2>
              <span className="rounded bg-[var(--signal)]/14 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--signal-bright)]">
                {angle}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[12px] tracking-tight text-[var(--ink-soft)] sm:text-[13px]">
              {routeLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-1">
            {legs.length > 0 ? (
              legs.map((leg, i) => (
                <TripLegDetailCard
                  key={`${leg.originCode}-${leg.destinationCode}-${i}`}
                  leg={leg}
                  index={i}
                  showTransferAfter={isMultiTicket && i < legs.length - 1}
                />
              ))
            ) : (
              <p className="text-[14px] text-[var(--ink-soft)]">{itinerary.hops.join(" → ")}</p>
            )}
            <FarePanel itinerary={itinerary} onBook={onBook} className="mt-4 lg:hidden" />
          </div>

          <div className="hidden lg:sticky lg:top-6 lg:block">
            <FarePanel itinerary={itinerary} onBook={onBook} />
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

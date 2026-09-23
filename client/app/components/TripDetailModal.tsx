"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { ItinerarySummary } from "@/lib/consultant/types";
import { formatPriceMinor } from "@/lib/ask-ai/sidebarFilters";
import {
  BAGGAGE_UNAVAILABLE,
  cabinLabel,
  formatDurationLabel,
} from "./flightOfferFormat";
import {
  DetailFareMotif,
  DoodleLuggage,
  DoodlePassport,
} from "@/components/travel/TravelDoodles";
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
  booking,
  className = "",
}: {
  itinerary: ItinerarySummary;
  onBook: () => void;
  booking?: boolean;
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

  const legs = itinerary.legs ?? [];
  // Fare composition, per leg — the trip total is the sum of its legs, so the
  // breakdown is the legs themselves rather than a base/tax split.
  const legRows = legs
    .filter((l) => l.priceMinor != null)
    .map((l) => ({
      label: `${l.originCode} → ${l.destinationCode}`,
      value: formatPriceMinor(l.priceMinor!, l.currency ?? itinerary.currency),
    }));
  const checkedKg = legs.map((l) => l.baggageKg).filter((k): k is number => k != null);
  const cabins = [...new Set(legs.map((l) => l.cabin).filter(Boolean))] as string[];
  const refundableLegs = legs.filter((l) => l.refundable === true).length;

  return (
    <aside className={`fo-fare-summary fo-fare-summary--detail fo-fare-ticket ${className}`}>
      <DetailFareMotif className="fo-fare-ticket__motif" />
      <div className="fo-fare-ticket__stub" aria-hidden>
        <span className="fo-fare-ticket__stub-hole" />
        <span className="fo-fare-ticket__stub-hole" />
        <span className="fo-fare-ticket__stub-hole" />
      </div>

      <div className="fo-fare-summary__top">
        <p className="fo-fare-summary__eyebrow">Complete trip</p>
        <p className="offer-price fo-fare-summary__price">
          {code ? <span className="fo-fare-summary__price-code">{code}</span> : null}
          <span className="fo-fare-summary__price-amount">{amount}</span>
        </p>
        <p className="fo-fare-summary__brand">
          {isMultiTicket ? "Self-transfer · separate tickets" : "Single ticket"}
          {totalDuration > 0 ? ` · ${formatDurationLabel(totalDuration, "long")} total` : ""}
        </p>
        <div className="fo-fare-summary__tags">
          {cabins.map((c) => (
            <span key={c} className="fo-fare-summary__tag">
              {cabinLabel(c as "economy" | "premium" | "business")}
            </span>
          ))}
          {legs.length > 0 ? (
            <span className="fo-fare-summary__tag">{legs.length} legs</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onBook}
        disabled={hasMarketReference || booking}
        aria-busy={booking}
        className="fo-fare-summary__cta"
      >
        {hasMarketReference
          ? "Market reference only"
          : booking
            ? "Opening checkout…"
            : "View Deal"}
        {hasMarketReference || booking ? null : <span aria-hidden>→</span>}
      </button>

      {isMultiTicket ? (
        <p className="fo-fare-summary__notice">
          You change planes or airports between tickets. Allow extra time for immigration,
          baggage reclaim, and check-in.
        </p>
      ) : null}

      {hasMarketReference ? (
        <p className="fo-fare-summary__notice">
          Some legs are Google Flights market estimates — not bookable through FlightOne.
        </p>
      ) : (
        <p className="fo-fare-summary__notice">
          Price captured at search. Confirm before ticketing.
        </p>
      )}

      {legRows.length > 0 ? (
        <div className="fo-fare-summary__block">
          <p className="fo-fare-summary__section-title">Fare composition</p>
          {legRows.map((row) => (
            <div key={row.label} className="fo-fare-summary__row">
              <span className="fo-fare-summary__row-label">{row.label}</span>
              <span className="fo-fare-summary__row-value">{row.value}</span>
            </div>
          ))}
          <div className="fo-fare-summary__row">
            <span className="fo-fare-summary__row-label">Trip total</span>
            <span className="fo-fare-summary__row-value">{itinerary.totalPrice}</span>
          </div>
        </div>
      ) : null}

      <div className="fo-fare-summary__block">
        <p className="fo-fare-summary__section-title">
          <DoodleLuggage className="fo-fare-summary__section-icon" size={14} />
          Baggage
        </p>
        {checkedKg.length > 0 ? (
          <div className="fo-fare-summary__row">
            <span className="fo-fare-summary__row-label">Checked</span>
            <span className="fo-fare-summary__row-value">
              {/* Lowest allowance across legs — the one that actually binds. */}
              {Math.min(...checkedKg)} kg
            </span>
          </div>
        ) : (
          <p className="fo-fare-summary__note">{BAGGAGE_UNAVAILABLE}</p>
        )}
      </div>

      <div className="fo-fare-summary__block">
        <p className="fo-fare-summary__section-title">
          <DoodlePassport className="fo-fare-summary__section-icon" size={14} />
          Fare rules
        </p>
        <div className="fo-fare-summary__row">
          <span className="fo-fare-summary__row-label">Refundable</span>
          <span className="fo-fare-summary__row-value">
            {refundableLegs === 0
              ? "No"
              : refundableLegs === legs.length
                ? "Yes"
                : `${refundableLegs} of ${legs.length} legs`}
          </span>
        </div>
        <div className="fo-fare-summary__row">
          <span className="fo-fare-summary__row-label">Ticketing</span>
          <span className="fo-fare-summary__row-value">
            {isMultiTicket ? "Separate tickets" : "Single ticket"}
          </span>
        </div>
      </div>

      {itinerary.reasons.length > 0 ? (
        <div className="fo-fare-summary__block">
          <p className="fo-fare-summary__section-title">Why this trip</p>
          {itinerary.reasons.map((r) => (
            <p key={r} className="fo-fare-summary__note">
              {r}
            </p>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function TripDetailModal({
  itinerary,
  onClose,
  onBook,
  booking,
}: {
  itinerary: ItinerarySummary;
  onClose: () => void;
  onBook: () => void;
  /** Quote in flight — CTA shows pending and the modal stays mounted. */
  booking?: boolean;
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
            <FarePanel itinerary={itinerary} onBook={onBook} booking={booking} className="mt-4 lg:hidden" />
          </div>

          <div className="hidden lg:sticky lg:top-6 lg:block">
            <FarePanel itinerary={itinerary} onBook={onBook} booking={booking} />
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

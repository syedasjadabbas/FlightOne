"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { FlightSegment } from "@/lib/inventory/types";
import type { ItinerarySummary } from "@/lib/consultant/types";
import { tripStops } from "@/lib/ask-ai/tripStops";
import { formatPriceMinor } from "@/lib/ask-ai/sidebarFilters";
import {
  cabinLabel,
  formatDayLabel,
  formatDurationLabel,
  stopsLabel,
} from "./flightOfferFormat";
import { BAGGAGE_UNAVAILABLE } from "@/lib/inventory/fareDisplay";
import { iataToPlace } from "@/lib/inventory/places";
import { FlightTimeline } from "@/components/travel/FlightTimeline";
import {
  DetailAmbience,
  DetailFareMotif,
  DetailScene,
  DoodleLuggage,
  DoodlePassport,
  DoodlePlaneMini,
  ObjectPin,
  ObjectPlane,
  ObjectSuitcase,
  RouteMotif,
} from "@/components/travel/TravelDoodles";

function AirlineMark({ code, size = 36 }: { code: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://images.kiwi.com/airlines/64/${code}.png`}
      alt=""
      width={size}
      height={size}
      className="fo-detail-airline__img"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
        if (sibling) sibling.hidden = false;
      }}
    />
  );
}

function AirlineBadge({ code, name, size = 40 }: { code: string; name: string; size?: number }) {
  return (
    <span className="fo-detail-airline" style={{ width: size, height: size }} aria-hidden>
      <AirlineMark code={code} size={size} />
      <span hidden className="fo-detail-airline__fallback">
        {code.slice(0, 2)}
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

function legSegments(leg: NonNullable<ItinerarySummary["legs"]>[number]): FlightSegment[] {
  if (leg.segments?.length) return leg.segments;
  return [
    {
      carrier: leg.airlineCode,
      flightNumber: leg.flightNumber || leg.airlineCode,
      aircraft: leg.aircraft ?? null,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      departureDate: leg.departureDate || "",
      departTimeLocal: leg.departTimeLocal,
      arrivalDate: leg.departureDate || "",
      arriveTimeLocal: leg.arriveTimeLocal || "",
      durationMinutes: leg.durationMinutes,
    },
  ];
}

function BoundHero({
  segments,
  durationMinutes,
  stops,
  label,
}: {
  segments: FlightSegment[];
  durationMinutes?: number;
  stops?: number;
  label?: string;
}) {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) return null;

  const day = formatDayLabel(first.departureDate);
  const dur =
    durationMinutes && durationMinutes > 0
      ? formatDurationLabel(durationMinutes, "long")
      : first.durationMinutes
        ? formatDurationLabel(first.durationMinutes, "long")
        : null;
  const stopBit = typeof stops === "number" ? stopsLabel(stops) : null;

  return (
    <div className="fo-bound-hero">
      {label ? (
        <p className="fo-bound-hero__label">
          <DoodlePlaneMini className="fo-bound-hero__label-icon" />
          {label}
        </p>
      ) : null}
      <div className="fo-bound-hero__times">
        <div className="fo-bound-hero__end">
          <ObjectPin className="fo-bound-hero__pin" size={22} />
          <time className="fo-bound-hero__clock tabular-nums">{first.departTimeLocal || "—"}</time>
          <span className="fo-bound-hero__iata">{first.originCode}</span>
          <span className="fo-bound-hero__city">{iataToPlace(first.originCode)}</span>
        </div>
        <div className="fo-bound-hero__mid" aria-hidden>
          <RouteMotif
            from={first.originCode}
            to={last.destinationCode}
            size="sm"
            className="fo-bound-hero__motif"
          />
          <ObjectPlane className="fo-bound-hero__plane fo-float fo-float--slow" size={48} />
        </div>
        <div className="fo-bound-hero__end fo-bound-hero__end--arr">
          <ObjectPin className="fo-bound-hero__pin" size={22} />
          <time className="fo-bound-hero__clock tabular-nums">
            {last.arriveTimeLocal || "—"}
          </time>
          <span className="fo-bound-hero__iata">{last.destinationCode}</span>
          <span className="fo-bound-hero__city">{iataToPlace(last.destinationCode)}</span>
        </div>
      </div>
      <p className="fo-bound-hero__facts">
        {[day, dur, stopBit].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function FarePanel({
  itinerary,
  onBook,
  booking,
}: {
  itinerary: ItinerarySummary;
  onBook: () => void;
  booking?: boolean;
}) {
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const hasMarketReference =
    itinerary.hasMarketReferenceLeg ||
    (itinerary.legs?.some((leg) => leg.marketReference) ?? false);
  const parts = itinerary.totalPrice.trim().split(/\s+/);
  const priceCode = parts.length > 1 ? parts[0] : itinerary.currency;
  const priceAmount = parts.length > 1 ? parts.slice(1).join(" ") : itinerary.totalPrice;
  const totalDuration =
    itinerary.legs?.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0) ?? 0;

  const legs = itinerary.legs ?? [];
  const legRows = legs
    .filter((l) => l.priceMinor != null)
    .map((l) => ({
      label: `${l.originCode} → ${l.destinationCode}`,
      value: formatPriceMinor(l.priceMinor!, l.currency ?? itinerary.currency),
    }));
  const checkedKg = legs.map((l) => l.baggageKg).filter((k): k is number => k != null);
  const cabins = [...new Set(legs.map((l) => l.cabin).filter(Boolean))] as ("economy" | "premium" | "business")[];
  const refundableLegs = legs.filter((l) => l.refundable === true).length;

  return (
    <aside className="fo-fare-summary fo-fare-summary--detail fo-fare-ticket">
      <DetailFareMotif className="fo-fare-ticket__motif" />
      <div className="fo-fare-ticket__stub" aria-hidden>
        <span className="fo-fare-ticket__stub-hole" />
        <span className="fo-fare-ticket__stub-hole" />
        <span className="fo-fare-ticket__stub-hole" />
      </div>

      <div className="fo-fare-summary__top">
        <p className="fo-fare-summary__eyebrow">Your fare</p>
        <p className="offer-price fo-fare-summary__price">
          {priceCode ? <span className="fo-fare-summary__price-code">{priceCode}</span> : null}
          <span className="fo-fare-summary__price-amount">{priceAmount}</span>
        </p>
        <p className="fo-fare-summary__brand">
          {isMultiTicket ? "Self-transfer · separate tickets" : "Single ticket"}
          {totalDuration > 0 ? ` · ${formatDurationLabel(totalDuration, "long")} total` : ""}
        </p>
        <div className="fo-fare-summary__tags">
          {cabins.map((c) => (
            <span key={c} className="fo-fare-summary__tag">
              {cabinLabel(c)}
            </span>
          ))}
          {legs.length > 0 ? (
            <span className="fo-fare-summary__tag">{legs.length} flights</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onBook}
        disabled={booking}
        aria-busy={booking}
        className="fo-fare-summary__cta"
      >
        {booking ? "Opening checkout…" : "Proceed to checkout"}
        {booking ? null : <span aria-hidden>→</span>}
      </button>

      {isMultiTicket ? (
        <p className="fo-fare-summary__notice">
          You change planes or airports between tickets. Allow extra time for immigration,
          baggage reclaim, and check-in.
        </p>
      ) : null}

      <p className="fo-fare-summary__notice">
        Price captured at search. Confirm before ticketing.
      </p>

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
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const hasMarketReference =
    itinerary.hasMarketReferenceLeg ||
    (itinerary.legs?.some((leg) => leg.marketReference) ?? false);
  const hops = tripStops(itinerary);
  const firstOrigin = hops[0]?.code || "LHE";
  const lastDest = hops[hops.length - 1]?.code || "LHE";
  // Screen readers get the journey as a sentence rather than a string of codes.
  const routeSpoken = hops
    .map((s, i) =>
      i === 0
        ? iataToPlace(s.code)
        : `${s.groundGapBefore ? "then from" : "to"} ${iataToPlace(s.code)}`,
    )
    .join(" ");
  const totalDuration =
    legs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
  const cabins = [...new Set(legs.map((l) => l.cabin).filter(Boolean))] as ("economy" | "premium" | "business")[];
  const dominantCabin = cabins[0] ?? "economy";

  const primaryAirlineCode = legs[0]?.airlineCode || "QR";
  const primaryAirlineName = legs[0]?.airline || "FlightOne";
  const uniqueAirlines = [...new Set(legs.map((l) => l.airline).filter(Boolean))];
  const carrierDisplay =
    uniqueAirlines.length > 1
      ? `${primaryAirlineName} + ${uniqueAirlines.length - 1} more`
      : primaryAirlineName;

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
      className="fo-detail-page fo-detail-page--scenic"
    >
      <DetailAmbience />
      <div className="fo-detail-page__sky" aria-hidden />

      <header className="fo-detail-page__header">
        <div className="fo-detail-page__nav">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="fo-detail-back"
            aria-label="Back to offers"
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

          <div className="fo-detail-carrier">
            <AirlineBadge code={primaryAirlineCode} name={carrierDisplay} size={36} />
            <div>
              <p className="fo-detail-carrier__name">{carrierDisplay}</p>
              <p className="fo-detail-carrier__cabin">{cabinLabel(dominantCabin)}</p>
            </div>
          </div>
        </div>

        <div className="fo-detail-stage fo-detail-stage--multi">
          <DetailScene
            className="fo-detail-stage__scene"
            from={firstOrigin}
            to={lastDest}
          />
          <div className="fo-detail-hero">
            <p className="fo-detail-hero__kicker">Your trip · Multi-city</p>
            <h2
              className={`fo-detail-hero__route fo-detail-hero__route--multi${
                hops.length > 4 ? " fo-detail-hero__route--long" : ""
              }`}
              id={titleId}
              aria-label={routeSpoken}
            >
              {hops.map((stop, i) => {
                const next = hops[i + 1];
                return (
                  // The connector travels with the code BEFORE it, so a wrapped
                  // line ends "LHR →" (reads as "continues") rather than
                  // starting with a stray arrow.
                  <span key={`${stop.code}-${i}`} className="fo-detail-hero__stop" aria-hidden>
                    <span className="fo-detail-hero__code tabular-nums">{stop.code}</span>
                    {next ? (
                      next.groundGapBefore ? (
                        <span className="fo-detail-hero__gap" title="Separate departure airport">
                          /
                        </span>
                      ) : (
                        <span className="fo-detail-hero__arrow">→</span>
                      )
                    ) : null}
                  </span>
                );
              })}
            </h2>
            <p className="fo-detail-hero__cities">
              {hops.map((s) => iataToPlace(s.code)).join(" · ")}
            </p>
            <ul className="fo-detail-hero__chips" aria-label="Trip summary">
              <li>{legs.length} flights</li>
              {totalDuration > 0 ? (
                <li>{formatDurationLabel(totalDuration, "long")} total</li>
              ) : null}
              <li>{isMultiTicket ? "Separate tickets" : "Single ticket"}</li>
              <li>{cabinLabel(dominantCabin)}</li>
            </ul>
          </div>
        </div>
      </header>

      <div className="fo-detail-page__scroll">
        <div className="fo-detail-page__body">
          <div className="fo-detail-main">
            <section className="fo-detail-trip">
              <div className="fo-detail-trip__ornament" aria-hidden>
                <ObjectSuitcase className="fo-float fo-float--slower" size={40} />
                <ObjectPlane className="fo-float fo-float--slow" size={56} />
              </div>

              <div className="fo-detail-trip__head">
                <p className="fo-detail-section-label">
                  <DoodlePlaneMini className="fo-detail-section-label__icon" />
                  Itinerary
                </p>
              </div>

              {legs.length > 0 ? (
                legs.map((leg, i) => {
                  const segments = legSegments(leg);
                  return (
                    <div
                      key={`${leg.originCode}-${leg.destinationCode}-${i}`}
                      className={`fo-detail-bound${i > 0 ? " fo-detail-bound--return" : ""}`}
                    >
                      <BoundHero
                        segments={segments}
                        durationMinutes={leg.durationMinutes}
                        stops={leg.stops}
                        label={`Flight ${i + 1}: ${leg.originCode} → ${leg.destinationCode}`}
                      />
                      <FlightTimeline
                        segments={segments}
                        variant="rail"
                      />
                      {isMultiTicket && i < legs.length - 1 && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--electric)_20%,var(--line))] bg-[color-mix(in_oklab,var(--electric)_5%,white)] px-3.5 py-2 text-[12px] text-[var(--ink-soft)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--electric)]" aria-hidden />
                          <span>
                            Self-transfer in <strong>{iataToPlace(leg.destinationCode)} ({leg.destinationCode})</strong> · Separate ticket
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-4 text-[14px] text-[var(--ink-soft)]">
                  {hops.map((s) => s.code).join(" → ")}
                </p>
              )}
            </section>
          </div>

          <div className="fo-detail-fare-col">
            <FarePanel itinerary={itinerary} onBook={onBook} booking={booking} />
          </div>
        </div>
      </div>

      <div className="fo-detail-mobile-bar">
        <div className="fo-detail-mobile-bar__price">
          <span className="fo-detail-mobile-bar__label">Total</span>
          <span className="fo-detail-mobile-bar__amount offer-price">{itinerary.totalPrice}</span>
        </div>
        <button
          type="button"
          onClick={onBook}
          disabled={booking}
          aria-busy={booking}
          className="fo-detail-mobile-bar__cta"
        >
          {booking ? "Opening checkout…" : "Proceed to checkout"}
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

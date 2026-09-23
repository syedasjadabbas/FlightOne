"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { FlightSegment } from "@/lib/inventory/types";
import type { OfferCard, OfferCardFlight } from "@/lib/consultant/types";
import {
  cabinLabel,
  formatDayLabel,
  formatDurationLabel,
  stopsLabel,
} from "./flightOfferFormat";
import {
  BAGGAGE_UNAVAILABLE,
  FARE_RULES_UNAVAILABLE,
  fareFamilyLabel,
  fareRuleRows,
  formatSupplierPriceBreakdown,
} from "@/lib/inventory/fareDisplay";
import { isSearchOnlyFare } from "@/lib/inventory/offerRevalidation";
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
    // eslint-disable-next-line @next/next/no-img-element -- remote airline mark with lettermark fallback
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

function syntheticOutbound(flight: OfferCardFlight): FlightSegment[] {
  if (flight.segments?.length) return flight.segments;
  return [
    {
      carrier: flight.airlineCode,
      flightNumber: flight.flightNumber || flight.airlineCode,
      aircraft: flight.aircraft ?? null,
      originCode: flight.originCode,
      destinationCode: flight.destinationCode,
      departureDate: flight.departureDate || "",
      departTimeLocal: flight.departTimeLocal,
      arrivalDate: flight.departureDate || "",
      arriveTimeLocal: flight.arriveTimeLocal || "",
      durationMinutes: flight.durationMinutes || null,
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
  offer,
  onBook,
  booking,
}: {
  offer: OfferCard;
  onBook: () => void;
  booking?: boolean;
}) {
  const flight = offer.flight!;
  const brand = fareFamilyLabel(flight.fareBrandName, flight.cabin);
  const supplierLines = formatSupplierPriceBreakdown(flight.supplierPriceBreakdown);
  const searchOnly = isSearchOnlyFare(offer);
  const allowance = flight.baggageAllowance;
  const ruleRows = fareRuleRows(flight.fareRulesSummary, flight.refundable);

  const carryOnLabel = allowance?.carryOn
    ? allowance.carryOn.included
      ? allowance.carryOn.pieces
        ? `${allowance.carryOn.pieces} piece`
        : "Included"
      : allowance.carryOn.text ?? "Not included"
    : null;

  const checkedLabel = allowance?.checked
    ? allowance.checked.included
      ? allowance.checked.weightKg
        ? `${allowance.checked.weightKg} kg`
        : allowance.checked.pieces
          ? `${allowance.checked.pieces} piece`
          : "Included"
      : allowance.checked.text ?? "Not included"
    : flight.baggageKg != null && flight.baggageKg > 0
      ? `${flight.baggageKg} kg`
      : null;

  const priceParts = offer.price.trim().split(/\s+/);
  const priceCode = priceParts.length > 1 ? priceParts[0] : "";
  const priceAmount = priceParts.length > 1 ? priceParts.slice(1).join(" ") : offer.price;

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
        <p className="fo-fare-summary__brand">{brand ?? cabinLabel(flight.cabin)}</p>
        <div className="fo-fare-summary__tags">
          {flight.bookingClass ? (
            <span className="fo-fare-summary__tag">Class {flight.bookingClass}</span>
          ) : null}
          {offer.roundTrip ? <span className="fo-fare-summary__tag">Round trip</span> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onBook}
        disabled={booking}
        aria-busy={booking}
        className="fo-fare-summary__cta"
      >
        {booking ? "Opening checkout…" : "View Deal"}
        {booking ? null : <span aria-hidden>→</span>}
      </button>

      {offer.unitsLeft != null && offer.unitsLeft <= 3 ? (
        <p className="fo-fare-summary__scarce">Only {offer.unitsLeft} left at this fare</p>
      ) : null}

      {searchOnly ? (
        <p className="fo-fare-summary__notice">
          Price captured at search. Confirm before ticketing.
        </p>
      ) : null}

      {supplierLines.length > 0 ? (
        <div className="fo-fare-summary__block">
          <p className="fo-fare-summary__section-title">Fare composition</p>
          {supplierLines.map((line) => {
            const match = line.match(/^(Base|Taxes|Fees|Supplier total)\s+(.+)$/);
            const label = match?.[1] ?? line;
            const value = match?.[2] ?? "";
            return (
              <div key={line} className="fo-fare-summary__row">
                <span className="fo-fare-summary__row-label">{label}</span>
                <span className="fo-fare-summary__row-value">{value}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="fo-fare-summary__block">
        <p className="fo-fare-summary__section-title">
          <DoodleLuggage className="fo-fare-summary__section-icon" size={14} />
          Baggage
        </p>
        {carryOnLabel ? (
          <div className="fo-fare-summary__row">
            <span className="fo-fare-summary__row-label">Carry-on</span>
            <span className="fo-fare-summary__row-value">{carryOnLabel}</span>
          </div>
        ) : null}
        {checkedLabel ? (
          <div className="fo-fare-summary__row">
            <span className="fo-fare-summary__row-label">Checked</span>
            <span className="fo-fare-summary__row-value">{checkedLabel}</span>
          </div>
        ) : null}
        {!carryOnLabel && !checkedLabel ? (
          <p className="fo-fare-summary__note">{BAGGAGE_UNAVAILABLE}</p>
        ) : null}
      </div>

      <div className="fo-fare-summary__block">
        <p className="fo-fare-summary__section-title">
          <DoodlePassport className="fo-fare-summary__section-icon" size={14} />
          Fare rules
        </p>
        {ruleRows.length > 0 ? (
          ruleRows.map((row) => (
            <div key={row.label} className="fo-fare-summary__row">
              <span className="fo-fare-summary__row-label">{row.label}</span>
              <span className="fo-fare-summary__row-value">{row.value}</span>
            </div>
          ))
        ) : (
          <p className="fo-fare-summary__note">{FARE_RULES_UNAVAILABLE}</p>
        )}
      </div>

      {flight.paymentTimeLimit ? (
        <div className="fo-fare-summary__block">
          <p className="fo-fare-summary__section-title">Payment deadline</p>
          <p className="fo-fare-summary__deadline">
            {new Date(flight.paymentTimeLimit).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      ) : null}
    </aside>
  );
}

export function FlightOfferDetailModal({
  offer,
  onClose,
  onBook,
  booking,
}: {
  offer: OfferCard;
  onClose: () => void;
  onBook: () => void;
  /** Quote in flight — CTAs show pending and the modal stays mounted. */
  booking?: boolean;
}) {
  const flight = offer.flight!;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const outbound = syntheticOutbound(flight);
  const returnSegments = flight.returnSegments ?? [];
  const isRoundTrip = Boolean(offer.roundTrip);
  const outDur =
    flight.durationMinutes > 0 ? formatDurationLabel(flight.durationMinutes, "long") : null;
  const retDur =
    flight.returnDurationMinutes && flight.returnDurationMinutes > 0
      ? formatDurationLabel(flight.returnDurationMinutes, "long")
      : null;
  const tripType = isRoundTrip ? "Round trip" : "One way";
  const stopsBit =
    typeof flight.returnStops === "number"
      ? `${stopsLabel(flight.stops)} / ${stopsLabel(flight.returnStops)}`
      : stopsLabel(flight.stops);

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
            <AirlineBadge code={flight.airlineCode} name={flight.airline} size={36} />
            <div>
              <p className="fo-detail-carrier__name">{flight.airline}</p>
              <p className="fo-detail-carrier__cabin">{cabinLabel(flight.cabin)}</p>
            </div>
          </div>
        </div>

        <div className="fo-detail-stage">
          <DetailScene
            className="fo-detail-stage__scene"
            from={flight.originCode}
            to={flight.destinationCode}
          />
          <div className="fo-detail-hero">
            <p className="fo-detail-hero__kicker">Your flight</p>
            <div className="fo-detail-hero__route" id={titleId}>
              <span className="fo-detail-hero__code tabular-nums">{flight.originCode}</span>
              <span className="fo-detail-hero__arrow" aria-hidden>
                {isRoundTrip ? "⇄" : "→"}
              </span>
              <span className="fo-detail-hero__code tabular-nums">{flight.destinationCode}</span>
            </div>
            <p className="fo-detail-hero__cities">
              {flight.originCity} {isRoundTrip ? "⇄" : "to"} {flight.destinationCity}
            </p>
            <ul className="fo-detail-hero__chips" aria-label="Trip summary">
              <li>{tripType}</li>
              {outDur ? <li>{outDur}</li> : null}
              {retDur ? <li>Return {retDur}</li> : null}
              <li>{stopsBit}</li>
              <li>{cabinLabel(flight.cabin)}</li>
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

              <div className="fo-detail-bound">
                <BoundHero
                  segments={outbound}
                  durationMinutes={flight.durationMinutes}
                  stops={flight.stops}
                  label={isRoundTrip ? "Outbound" : "Departure"}
                />
                <FlightTimeline
                  segments={outbound}
                  connectionWarnings={flight.connectionWarnings}
                  hubStitched={offer.hubStitched}
                  variant="rail"
                />
              </div>

              {isRoundTrip ? (
                <div className="fo-detail-bound fo-detail-bound--return">
                  {returnSegments.length > 0 ? (
                    <>
                      <BoundHero
                        segments={returnSegments}
                        durationMinutes={flight.returnDurationMinutes}
                        stops={flight.returnStops}
                        label="Return"
                      />
                      <FlightTimeline
                        segments={returnSegments}
                        connectionWarnings={flight.connectionWarnings}
                        hubStitched={offer.hubStitched}
                        variant="rail"
                      />
                    </>
                  ) : (
                    <>
                      <p className="fo-bound-hero__label">Return</p>
                      <p className="fo-detail-bound__empty">
                        Return on{" "}
                        {formatDayLabel(offer.returnDate) || offer.returnDate || "your return date"} —
                        exact times confirmed at booking.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          <div className="fo-detail-fare-col">
            <FarePanel offer={offer} onBook={onBook} booking={booking} />
          </div>
        </div>
      </div>

      <div className="fo-detail-mobile-bar">
        <div className="fo-detail-mobile-bar__price">
          <span className="fo-detail-mobile-bar__label">Total</span>
          <span className="fo-detail-mobile-bar__amount offer-price">{offer.price}</span>
        </div>
        <button
          type="button"
          onClick={onBook}
          disabled={booking}
          aria-busy={booking}
          className="fo-detail-mobile-bar__cta"
        >
          {booking ? "Opening checkout…" : "View Deal"}
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

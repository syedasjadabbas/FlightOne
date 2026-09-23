"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import type { FlightSegment } from "@/lib/inventory/types";
import type { ItinerarySummary } from "@/lib/consultant/types";
import {
  formatDayLabel,
  formatDurationLabel,
  stopsLabel,
} from "../flightOfferFormat";
import { formatBaggageAllowance, fareFamilyLabel } from "@/lib/inventory/fareDisplay";
import { FlightTimeline } from "@/components/travel/FlightTimeline";
import { AirlineMark } from "./ResultsVisual";
import { DoodleStamp } from "@/components/travel/TravelDoodles";

const ANGLE_BADGE: Record<string, { label: string; tone: "best" | "cheap" | "value" | "other" }> = {
  best_value: { label: "Best", tone: "best" },
  recommended: { label: "Best", tone: "best" },
  cheapest: { label: "Cheapest", tone: "cheap" },
  fastest: { label: "Fastest", tone: "other" },
  premium: { label: "Premium", tone: "other" },
  top_rated: { label: "Good value", tone: "value" },
};

function AngleBadge({ angle }: { angle: string }) {
  const badge = ANGLE_BADGE[angle] ?? { label: angle, tone: "other" as const };
  return (
    <span className={`flight-result-badge flight-result-badge--${badge.tone}`}>
      {badge.label}
    </span>
  );
}

function isFeaturedOffer(angle: string): boolean {
  return angle === "best_value" || angle === "recommended";
}

function legSegmentList(leg: NonNullable<ItinerarySummary["legs"]>[number]): FlightSegment[] {
  if (leg.segments?.length) return leg.segments;
  return [
    {
      carrier: leg.airlineCode,
      flightNumber: leg.flightNumber ?? "",
      aircraft: leg.aircraft ?? null,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      departureDate: leg.departureDate ?? "",
      departTimeLocal: leg.departTimeLocal,
      arrivalDate: leg.departureDate ?? "",
      arriveTimeLocal: leg.arriveTimeLocal ?? "",
      durationMinutes: leg.durationMinutes,
    },
  ];
}

function ItineraryDetails({
  itinerary,
  onSelect,
}: {
  itinerary: ItinerarySummary;
  onSelect?: (itinerary: ItinerarySummary) => void;
}) {
  const legs = itinerary.legs ?? [];
  const isMultiTicket = itinerary.construction === "multiple_tickets";

  const benefits: string[] = [
    isMultiTicket ? "Separate tickets (self-transfer)" : "Single through-ticket",
  ];
  if (legs.some((l) => l.refundable)) benefits.push("Refundable options");
  const baggageSet = new Set(
    legs
      .map((l) => formatBaggageAllowance(undefined, l.baggageKg))
      .filter((b): b is string => Boolean(b && b.trim())),
  );
  if (baggageSet.size > 0) {
    benefits.push([...baggageSet].join(" · "));
  }

  const parts = itinerary.totalPrice.trim().split(/\s+/);
  const priceCode = parts.length > 1 ? parts[0] : itinerary.currency;
  const priceAmount = parts.length > 1 ? parts.slice(1).join(" ") : itinerary.totalPrice;

  return (
    <div className="flight-result-details">
      <div className="space-y-5">
        {legs.map((leg, i) => {
          const segments = legSegmentList(leg);
          const dayLabel = leg.departureDate ? formatDayLabel(leg.departureDate) : null;
          return (
            <div key={`${leg.originCode}-${leg.destinationCode}-${i}`} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--line)]/60 pb-1.5">
                <span className="text-[12px] font-semibold text-[var(--navy)]">
                  Flight {i + 1}: {leg.originCode} → {leg.destinationCode}
                </span>
                {dayLabel ? (
                  <span className="text-[12px] text-[var(--ink-soft)]">{dayLabel}</span>
                ) : null}
              </div>
              <FlightTimeline
                segments={segments}
                hubStitched={isMultiTicket}
                variant="compact"
              />
            </div>
          );
        })}
      </div>

      <div className="flight-result-details__fare-strip mt-3">
        <div className="flight-result-details__fare-info">
          <div className="flight-result-details__fare-head">
            <DoodleStamp className="flight-result-details__fare-doodle" />
            <p className="flight-result-details__fare-label">Complete trip fare</p>
          </div>
          <ul className="flight-result-details__benefits">
            {benefits.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <span className="flight-result-row__fare-count">
            {legs.length} flights combined in this itinerary
          </span>
        </div>
        <div className="flight-result-details__price-block">
          {priceCode ? (
            <span className="flight-result-row__price-code">{priceCode}</span>
          ) : null}
          <span className="flight-result-details__fare-price">{priceAmount}</span>
        </div>
      </div>

      <div className="flight-result-details__footer">
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(itinerary)}
            className="flight-result-details__link cursor-pointer"
          >
            Proceed to checkout →
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ItinerarySummaryCard({
  itinerary,
  index = 0,
  onSelect,
}: {
  itinerary: ItinerarySummary;
  index?: number;
  onSelect?: (itinerary: ItinerarySummary) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const hasMarketReference =
    itinerary.hasMarketReferenceLeg ||
    (itinerary.legs?.some((leg) => leg.marketReference) ?? false);
  const legs = itinerary.legs ?? [];
  const featured = isFeaturedOffer(itinerary.angle);

  const parts = itinerary.totalPrice.trim().split(/\s+/);
  const priceCode = parts.length > 1 ? parts[0] : "";
  const priceAmount = parts.length > 1 ? parts.slice(1).join(" ") : itinerary.totalPrice;

  return (
    <article
      className={`flight-result-row offer-enter${featured ? " flight-result-row--featured" : ""}${
        expanded ? " flight-result-row--expanded" : ""
      }`}
      style={{ animationDelay: `${20 + Math.min(index, 16) * 25}ms` }}
    >
      <div className="flight-result-row__main">
        <button
          type="button"
          className="flight-result-row__expand-hit text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`trip-details-${itinerary.id}`}
        >
          {legs.length > 0 ? (
            legs.map((leg, legIdx) => {
              const duration = formatDurationLabel(leg.durationMinutes, "short");
              const baggage = formatBaggageAllowance(undefined, leg.baggageKg);
              const segments = legSegmentList(leg);
              const viaCode =
                leg.stops > 0 && segments.length > 0
                  ? segments[0]?.destinationCode
                  : leg.stopCodes?.[0] ?? null;
              const stopsText =
                viaCode && leg.stops > 0
                  ? `${stopsLabel(leg.stops)} · ${viaCode}`
                  : stopsLabel(leg.stops);

              const cabinText =
                fareFamilyLabel(undefined, leg.cabin) ??
                (leg.cabin === "business"
                  ? "Business"
                  : leg.cabin === "premium"
                    ? "Premium Economy"
                    : "Economy");

              const dayLabel = leg.departureDate ? formatDayLabel(leg.departureDate) : null;
              const metaItems = [dayLabel, cabinText, baggage].filter(Boolean) as string[];

              return (
                <div
                  key={`${leg.originCode}-${leg.destinationCode}-${legIdx}`}
                  className={`flight-result-row__scan${
                    legIdx > 0 ? " pt-4 mt-4 border-t border-[var(--line)]/60" : ""
                  }`}
                >
                  <div className="flight-result-row__col flight-result-row__col--airline">
                    <div className="flight-result-row__identity">
                      <AirlineMark code={leg.airlineCode} />
                      <div className="flight-result-row__identity-text">
                        {legIdx === 0 ? <AngleBadge angle={itinerary.angle} /> : null}
                        <span className="flight-result-row__airline">{leg.airline}</span>
                        {leg.flightNumber ? (
                          <span className="flight-result-row__fn tabular-nums">
                            {leg.flightNumber}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {legIdx === 0 && (isMultiTicket || hasMarketReference) && (
                      <div className="flight-result-row__tags">
                        {isMultiTicket ? (
                          <span className="flight-result-row__tag">Self-transfer</span>
                        ) : null}
                        {hasMarketReference ? (
                          <span className="flight-result-row__tag">Market ref</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flight-result-row__col flight-result-row__col--dep">
                    <span className="flight-result-row__time tabular-nums">
                      {leg.departTimeLocal}
                    </span>
                    <span className="flight-result-row__code">{leg.originCode}</span>
                  </div>

                  <div className="flight-result-row__col flight-result-row__col--mid">
                    <span className="flight-result-row__dur">{duration}</span>
                    <span className="flight-result-row__line" aria-hidden>
                      <span className="flight-result-row__line-dot flight-result-row__line-dot--start" />
                      <span className="flight-result-row__line-track" />
                      <span className="flight-result-row__line-plane" aria-hidden>
                        <Plane className="flight-result-row__line-plane-icon" aria-hidden />
                      </span>
                      <span className="flight-result-row__line-dot flight-result-row__line-dot--end" />
                    </span>
                    <span className="flight-result-row__stops">{stopsText}</span>
                  </div>

                  <div className="flight-result-row__col flight-result-row__col--arr">
                    <span className="flight-result-row__time tabular-nums">
                      {leg.arriveTimeLocal ?? "—"}
                    </span>
                    <span className="flight-result-row__code">{leg.destinationCode}</span>
                  </div>

                  <div className="flight-result-row__col flight-result-row__col--meta">
                    <div className="flight-result-row__meta">
                      {metaItems.map((item, i) => (
                        <span key={i} className="flight-result-row__meta-item">
                          {i > 0 ? (
                            <span className="flight-result-row__meta-dot" aria-hidden>
                              ·
                            </span>
                          ) : null}
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-[13px] text-[var(--ink-soft)]">
              {itinerary.hops.join(" → ")}
            </div>
          )}
        </button>
      </div>

      <div className="flight-result-row__aside">
        <div className="flight-result-row__price">
          <span className="flight-result-row__price-label">YOUR FARE</span>
          <div className="flight-result-row__price-val">
            {priceCode ? (
              <span className="flight-result-row__price-code">{priceCode}</span>
            ) : null}
            <span className="offer-price flight-result-row__price-amount">{priceAmount}</span>
            <span className="flight-result-row__fare-count">
              {legs.length} flights · {isMultiTicket ? "Separate tickets" : "1 ticket"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect?.(itinerary)}
          className="flight-result-row__cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1"
        >
          Proceed to checkout
          <span aria-hidden>→</span>
        </button>
      </div>

      <div
        id={`trip-details-${itinerary.id}`}
        className={`flight-result-row__expand-panel${expanded ? " is-open" : ""}`}
        aria-hidden={!expanded}
      >
        <div className="flight-result-row__expand-inner">
          {expanded ? <ItineraryDetails itinerary={itinerary} onSelect={onSelect} /> : null}
        </div>
      </div>
    </article>
  );
}

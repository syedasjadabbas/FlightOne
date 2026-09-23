"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import type { FlightSegment } from "@/lib/inventory/types";
import type { OfferCard } from "@/lib/consultant/types";
import { formatDurationLabel, stopsLabel } from "../flightOfferFormat";
import { offerLayoverMinutes } from "@/lib/ask-ai/sidebarFilters";
import {
  formatBaggageAllowance,
  formatFareRulesSummary,
  fareFamilyLabel,
} from "@/lib/inventory/fareDisplay";
import { FlightTimeline } from "@/components/travel/FlightTimeline";
import { AirlineMark } from "./ResultsVisual";
import { DoodleStamp } from "@/components/travel/TravelDoodles";
import { OfferFeedbackControls } from "./OfferFeedbackControls";

const ANGLE_BADGE: Record<string, { label: string; tone: "best" | "cheap" | "value" | "other" }> = {
  best_value: { label: "Best", tone: "best" },
  recommended: { label: "Best", tone: "best" },
  cheapest: { label: "Cheapest", tone: "cheap" },
  fastest: { label: "Fastest", tone: "other" },
  premium: { label: "Premium", tone: "other" },
  top_rated: { label: "Good value", tone: "value" },
};

function cabinOrBrand(f: NonNullable<OfferCard["flight"]>): string {
  return (
    fareFamilyLabel(f.fareBrandName, f.cabin) ??
    (f.cabin === "business" ? "Business" : f.cabin === "premium" ? "Premium Economy" : "Economy")
  );
}

function fareBenefitRows(
  f: NonNullable<OfferCard["flight"]>,
  baggage: string,
  fareRules: string,
): string[] {
  const rows: string[] = [];
  const brand = cabinOrBrand(f);
  if (brand) rows.push(brand);
  if (f.bookingClass) rows.push(`Class ${f.bookingClass}`);
  for (const part of baggage.split(" · ")) {
    if (part.trim()) rows.push(part.trim());
  }
  for (const part of fareRules.split(" · ")) {
    if (part.trim()) rows.push(part.trim());
  }
  return rows;
}

function isFeaturedOffer(angle: string): boolean {
  return angle === "best_value" || angle === "recommended";
}

function AngleBadge({ angle }: { angle: string }) {
  const badge = ANGLE_BADGE[angle] ?? { label: angle, tone: "other" as const };
  return (
    <span className={`flight-result-badge flight-result-badge--${badge.tone}`}>
      {badge.label}
    </span>
  );
}

function segmentList(flight: NonNullable<OfferCard["flight"]>): FlightSegment[] {
  if (flight.segments?.length) return flight.segments;
  return [
    {
      carrier: flight.airlineCode,
      flightNumber: flight.flightNumber ?? "",
      aircraft: flight.aircraft,
      originCode: flight.originCode,
      destinationCode: flight.destinationCode,
      departureDate: flight.departureDate ?? "",
      departTimeLocal: flight.departTimeLocal,
      arrivalDate: flight.departureDate ?? "",
      arriveTimeLocal: flight.arriveTimeLocal ?? "",
      durationMinutes: flight.durationMinutes,
    },
  ];
}

function FlightDetails({
  offer,
  onViewOffer,
}: {
  offer: OfferCard;
  onViewOffer: (offer: OfferCard) => void;
}) {
  const f = offer.flight!;
  const segments = segmentList(f);
  const baggage = formatBaggageAllowance(f.baggageAllowance, f.baggageKg);
  const fareRules = formatFareRulesSummary(f.fareRulesSummary, f.refundable);

  const benefits = fareBenefitRows(f, baggage, fareRules);

  return (
    <div className="flight-result-details">
      <FlightTimeline
        segments={segments}
        connectionWarnings={f.connectionWarnings}
        hubStitched={offer.hubStitched}
        variant="compact"
      />
      <div className="flight-result-details__fare-strip">
        <div className="flight-result-details__fare-info">
          <div className="flight-result-details__fare-head">
            <DoodleStamp className="flight-result-details__fare-doodle" />
            <p className="flight-result-details__fare-label">Your fare</p>
          </div>
          <ul className="flight-result-details__benefits">
            {benefits.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          {offer.faresOnItinerary && offer.faresOnItinerary > 1 ? (
            <span className="flight-result-row__fare-count">
              {offer.faresOnItinerary} fares on this itinerary
            </span>
          ) : null}
        </div>
        <div className="flight-result-details__price-block">
          {offer.price.trim().split(/\s+/).length > 1 ? (
            <span className="flight-result-row__price-code">
              {offer.price.trim().split(/\s+/)[0]}
            </span>
          ) : null}
          <span className="flight-result-details__fare-price">
            {offer.price.trim().split(/\s+/).slice(1).join(" ") || offer.price}
          </span>
        </div>
      </div>
      <div className="flight-result-details__footer">
        <button type="button" onClick={() => onViewOffer(offer)} className="flight-result-details__link">
          Full details & booking →
        </button>
      </div>
    </div>
  );
}

function FlightRow({
  offer,
  index,
  onViewOffer,
  conversationId,
}: {
  offer: OfferCard;
  index: number;
  onViewOffer: (offer: OfferCard) => void;
  conversationId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const f = offer.flight!;
  const duration = formatDurationLabel(f.durationMinutes, "short");
  const baggage = formatBaggageAllowance(f.baggageAllowance, f.baggageKg);
  const layoverMins = offerLayoverMinutes(offer);
  const layover =
    layoverMins > 0 ? `${formatDurationLabel(layoverMins, "short")} layover` : null;
  const segments = segmentList(f);
  const viaCode =
    f.stops > 0 && segments.length > 0
      ? segments[0]?.destinationCode
      : null;
  const stopsText =
    viaCode && f.stops > 0
      ? `${stopsLabel(f.stops)} · ${viaCode}`
      : stopsLabel(f.stops);

  const priceParts = offer.price.trim().split(/\s+/);
  const priceCode = priceParts.length > 1 ? priceParts[0] : "";
  const priceAmount = priceParts.length > 1 ? priceParts.slice(1).join(" ") : offer.price;

  const featured = isFeaturedOffer(offer.angle);

  const cabinText =
    fareFamilyLabel(f.fareBrandName, f.cabin) ??
    (f.cabin === "business"
      ? "Business"
      : f.cabin === "premium"
        ? "Premium Economy"
        : "Economy");

  const baggageItems = baggage ? baggage.split(" · ").map((s) => s.trim()).filter(Boolean) : [];
  const metaItems = [cabinText, ...baggageItems, layover].filter(Boolean) as string[];

  return (
    <article
      className={`flight-result-row offer-enter${featured ? " flight-result-row--featured" : ""}${expanded ? " flight-result-row--expanded" : ""}`}
      style={{ animationDelay: `${20 + Math.min(index, 16) * 25}ms` }}
    >
      <div className="flight-result-row__main">
        <button
          type="button"
          className="flight-result-row__expand-hit"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`offer-details-${offer.id}`}
        >
          <div className="flight-result-row__scan">
            <div className="flight-result-row__col flight-result-row__col--airline">
              <div className="flight-result-row__identity">
                <AirlineMark code={f.airlineCode} />
                <div className="flight-result-row__identity-text">
                  <AngleBadge angle={offer.angle} />
                  <span className="flight-result-row__airline">{f.airline}</span>
                  {f.flightNumber ? (
                    <span className="flight-result-row__fn tabular-nums">{f.flightNumber}</span>
                  ) : null}
                </div>
              </div>
              {(offer.roundTrip || f.nearbyAirport || offer.hubStitched) && (
                <div className="flight-result-row__tags">
                  {offer.roundTrip ? (
                    <span className="flight-result-row__tag">Round trip</span>
                  ) : null}
                  {f.nearbyAirport ? (
                    <span className="flight-result-row__tag">Nearby</span>
                  ) : null}
                  {offer.hubStitched ? (
                    <span className="flight-result-row__tag">Multi-ticket</span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flight-result-row__col flight-result-row__col--dep">
              <span className="flight-result-row__time tabular-nums">{f.departTimeLocal}</span>
              <span className="flight-result-row__code">{f.originCode}</span>
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
              <span className="flight-result-row__time tabular-nums">{f.arriveTimeLocal ?? "—"}</span>
              <span className="flight-result-row__code">{f.destinationCode}</span>
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
            {offer.faresOnItinerary && offer.faresOnItinerary > 1 ? (
              <span className="flight-result-row__fare-count">{offer.faresOnItinerary} fares</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onViewOffer(offer)}
          className="flight-result-row__cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1"
        >
          View deal
          <span aria-hidden>→</span>
        </button>
        <OfferFeedbackControls offer={offer} conversationId={conversationId} />
      </div>

      <div
        id={`offer-details-${offer.id}`}
        className={`flight-result-row__expand-panel${expanded ? " is-open" : ""}`}
        aria-hidden={!expanded}
      >
        <div className="flight-result-row__expand-inner">
          {expanded ? <FlightDetails offer={offer} onViewOffer={onViewOffer} /> : null}
        </div>
      </div>
    </article>
  );
}

function GenericRow({
  offer,
  index,
  onViewOffer,
  conversationId,
}: {
  offer: OfferCard;
  index: number;
  onViewOffer: (offer: OfferCard) => void;
  conversationId?: string | null;
}) {
  return (
    <article
      className="flight-result-row flight-result-row--generic offer-enter"
      style={{ animationDelay: `${20 + Math.min(index, 16) * 25}ms` }}
    >
      <div className="flight-result-row__main">
        <AngleBadge angle={offer.angle} />
        <p className="flight-result-row__title">{offer.title}</p>
        <p className="flight-result-row__subtitle">{offer.subtitle}</p>
      </div>
      <div className="flight-result-row__aside">
        <span className="offer-price flight-result-row__price-amount">{offer.price}</span>
        <button
          type="button"
          onClick={() => onViewOffer(offer)}
          className="flight-result-row__cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-1"
        >
          View deal
          <span aria-hidden>→</span>
        </button>
        <OfferFeedbackControls offer={offer} conversationId={conversationId} />
      </div>
    </article>
  );
}

export function OfferRowCompact({
  offer,
  index = 0,
  onViewOffer,
  conversationId,
}: {
  offer: OfferCard;
  index?: number;
  onViewOffer: (offer: OfferCard) => void;
  conversationId?: string | null;
}) {
  if (offer.type === "flight" && offer.flight) {
    return (
      <FlightRow
        offer={offer}
        index={index}
        onViewOffer={onViewOffer}
        conversationId={conversationId}
      />
    );
  }
  return (
    <GenericRow
      offer={offer}
      index={index}
      onViewOffer={onViewOffer}
      conversationId={conversationId}
    />
  );
}

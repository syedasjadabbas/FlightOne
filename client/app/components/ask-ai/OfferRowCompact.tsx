"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import type { FlightSegment } from "@/lib/inventory/types";
import type { OfferCard } from "@/lib/consultant/types";
import {
  formatDayLabel,
  formatDurationLabel,
  parseOfferLegs,
  stopsLabel,
} from "../flightOfferFormat";
import { offerLayoverMinutes } from "@/lib/ask-ai/sidebarFilters";
import {
  formatBaggageAllowance,
  fareFamilyLabel,
} from "@/lib/inventory/fareDisplay";
import { FlightTimeline } from "@/components/travel/FlightTimeline";
import { AirlineMark } from "./ResultsVisual";
import { OfferFeedbackControls } from "./OfferFeedbackControls";
import { ExpandedFareCard } from "./ExpandedFareCard";

const ANGLE_BADGE: Record<string, { label: string; tone: "best" | "cheap" | "value" | "other" }> = {
  best_value: { label: "Best", tone: "best" },
  recommended: { label: "Best", tone: "best" },
  cheapest: { label: "Cheapest", tone: "cheap" },
  fastest: { label: "Fastest", tone: "other" },
  premium: { label: "Premium", tone: "other" },
  top_rated: { label: "Good value", tone: "value" },
};

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
  const legs = parseOfferLegs(offer);
  const baggage = formatBaggageAllowance(f.baggageAllowance, f.baggageKg);

  return (
    <div className="flight-result-details">
      <div className="space-y-4">
        {legs.map((leg, i) => {
          const dayLabel = leg.departureDate ? formatDayLabel(leg.departureDate) : null;
          return (
            <div key={`${leg.originCode}-${leg.destinationCode}-${i}`} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-(--line)/60 pb-1.5">
                <span className="text-[12px] font-semibold text-navy">
                  {leg.label || `Flight ${i + 1}: ${leg.originCode} → ${leg.destinationCode}`}
                </span>
                {dayLabel ? (
                  <span className="text-[12px] text-ink-soft">{dayLabel}</span>
                ) : null}
              </div>
              <FlightTimeline
                segments={leg.segments}
                connectionWarnings={i === 0 ? f.connectionWarnings : undefined}
                hubStitched={offer.hubStitched}
                variant="compact"
              />
            </div>
          );
        })}
      </div>

      <ExpandedFareCard
        fareBrand={f.fareBrandName}
        cabin={f.cabin}
        bookingClass={f.bookingClass}
        isMultiLeg={legs.length > 1}
        isMultiTicket={offer.hubStitched}
        isRoundTrip={offer.roundTrip}
        legCount={legs.length}
        faresOnItinerary={offer.faresOnItinerary}
        baggageAllowance={f.baggageAllowance}
        baggageKg={f.baggageKg}
        baggageSummary={baggage}
        fareRulesSummary={f.fareRulesSummary}
        refundable={f.refundable}
        price={offer.price}
        onAction={() => onViewOffer(offer)}
      />
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
  const legs = parseOfferLegs(offer);
  const isMultiLeg = legs.length > 1;

  const priceParts = offer.price.trim().split(/\s+/);
  const priceCode = priceParts.length > 1 ? priceParts[0] : "";
  const priceAmount = priceParts.length > 1 ? priceParts.slice(1).join(" ") : offer.price;

  const featured = isFeaturedOffer(offer.angle);

  return (
    <article
      className={`flight-result-row offer-enter${featured ? " flight-result-row--featured" : ""}${expanded ? " flight-result-row--expanded" : ""}`}
      style={{ animationDelay: `${20 + Math.min(index, 16) * 25}ms` }}
    >
      <div className="flight-result-row__main">
        <button
          type="button"
          className="flight-result-row__expand-hit text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`offer-details-${offer.id}`}
        >
          {legs.map((leg, legIdx) => {
            const duration = formatDurationLabel(leg.durationMinutes, "short");
            const baggage = formatBaggageAllowance(f.baggageAllowance, leg.baggageKg ?? f.baggageKg);
            const viaCode =
              (leg.stops ?? 0) > 0 && leg.segments.length > 0
                ? leg.segments[0]?.destinationCode
                : null;
            const stopsText =
              viaCode && (leg.stops ?? 0) > 0
                ? `${stopsLabel(leg.stops ?? 0)} · ${viaCode}`
                : stopsLabel(leg.stops ?? (leg.segments.length > 1 ? leg.segments.length - 1 : 0));

            const cabinText =
              fareFamilyLabel(f.fareBrandName, leg.cabin ?? f.cabin) ??
              (leg.cabin === "business"
                ? "Business"
                : leg.cabin === "premium"
                  ? "Premium Economy"
                  : "Economy");

            const baggageItems = baggage ? baggage.split(" · ").map((s) => s.trim()).filter(Boolean) : [];
            const dayLabel = isMultiLeg && leg.departureDate ? formatDayLabel(leg.departureDate) : null;
            const layoverMins = legIdx === 0 ? offerLayoverMinutes(offer) : 0;
            const layover =
              layoverMins > 0 ? `${formatDurationLabel(layoverMins, "short")} layover` : null;

            const metaItems = [dayLabel, cabinText, ...baggageItems, layover].filter(Boolean) as string[];

            return (
              <div
                key={`${leg.originCode}-${leg.destinationCode}-${legIdx}`}
                className={`flight-result-row__scan${
                  legIdx > 0 ? " pt-4 mt-4 border-t border-(--line)/60" : ""
                }`}
              >
                <div className="flight-result-row__col flight-result-row__col--airline">
                  <div className="flight-result-row__identity">
                    <AirlineMark code={leg.airlineCode} />
                    <div className="flight-result-row__identity-text">
                      {legIdx === 0 ? <AngleBadge angle={offer.angle} /> : null}
                      <span className="flight-result-row__airline">{leg.airline}</span>
                      {leg.flightNumber ? (
                        <span className="flight-result-row__fn tabular-nums">{leg.flightNumber}</span>
                      ) : null}
                    </div>
                  </div>
                  {legIdx === 0 && (offer.roundTrip || f.nearbyAirport || offer.hubStitched) && (
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
                  <span className="flight-result-row__time tabular-nums">{leg.departTimeLocal}</span>
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
                  <span className="flight-result-row__time tabular-nums">{leg.arriveTimeLocal ?? "—"}</span>
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
          })}
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

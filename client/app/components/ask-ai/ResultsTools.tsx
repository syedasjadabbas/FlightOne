"use client";

import { FEATURE_FLAGS } from "@/lib/ask-ai/featureFlags";
import { useEffect } from "react";
import { useGetFareInsightMutation } from "@/lib/api/recommendations.api";
import { fareActionLabel, fareStatusLabel, formatFareMinor } from "@/lib/recommendation/predictiveDisplay";

export function PriceCalendarStub({
  dateSpan,
  onAskFlexible,
}: {
  dateSpan?: string | null;
  onAskFlexible?: () => void;
}) {
  if (!FEATURE_FLAGS.priceCalendar) return null;

  return (
    <div className="results-tool-panel results-tool-panel--calendar">
      <p className="results-tool-panel__title">Price calendar</p>
      <p className="results-tool-panel__hint">
        {dateSpan
          ? `Compare nearby dates around ${dateSpan}. Live calendar pricing requires multi-date search data from Travelport.`
          : "Compare nearby dates to find cheaper options. Ask Ava for flexible dates to search a date range."}
      </p>
      {onAskFlexible ? (
        <button type="button" onClick={onAskFlexible} className="results-tool-panel__action">
          Search flexible dates with Ava
        </button>
      ) : null}
    </div>
  );
}

export function FareInsightPanel({
  origin,
  destination,
  currentAmountMinor,
  currency,
  departureDate,
}: {
  origin?: string | null;
  destination?: string | null;
  currentAmountMinor?: number | null;
  currency?: string | null;
  departureDate?: string | null;
}) {
  const [fetchInsight, { data, isLoading }] = useGetFareInsightMutation();

  useEffect(() => {
    if (!origin || !destination) return;
    void fetchInsight({
      origin,
      destination,
      ...(departureDate ? { departureDate } : {}),
      ...(Number.isInteger(currentAmountMinor) ? { currentAmountMinor: currentAmountMinor as number } : {}),
      ...(currency ? { currency } : {}),
    });
  }, [origin, destination, currentAmountMinor, currency, departureDate, fetchInsight]);

  if (!origin || !destination) return null;

  const current = data?.currentFare;
  const prediction = data?.prediction;

  return (
    <div className="results-tool-panel results-tool-panel--insight">
      <p className="results-tool-panel__title">Fare insight</p>
      {isLoading && !data ? (
        <p className="results-tool-panel__hint">Checking verified fares for this route…</p>
      ) : (
        <>
          <p className="results-tool-panel__hint">
            Current observed fare:{" "}
            {current?.available
              ? `${formatFareMinor(current.amountMinor, current.currency)} (verified from this search)`
              : "not available on this result set"}
          </p>
          <p className="results-tool-panel__hint">
            {prediction
              ? `${fareStatusLabel(prediction.status)}. ${fareActionLabel(prediction.suggestedAction)}. ${prediction.explanation}`
              : "Not enough data for a prediction."}
          </p>
          {prediction?.confidence ? (
            <p className="results-tool-panel__hint">
              Data quality: {prediction.confidence.quality || prediction.confidence.level}
              {Number.isInteger(prediction.confidence.sampleCount)
                ? ` (${prediction.confidence.sampleCount} prior observations)`
                : ""}
              . FlightOne will not book from this insight.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** @deprecated alias — fare insight is now live from observed snapshots, not a stub. */
export function PriceInsightStub(props: {
  origin?: string | null;
  destination?: string | null;
  currentAmountMinor?: number | null;
  currency?: string | null;
  departureDate?: string | null;
}) {
  return <FareInsightPanel {...props} />;
}

export function TrackPriceButton({
  onTrack,
  signedIn = false,
}: {
  onTrack?: () => void;
  signedIn?: boolean;
}) {
  if (!FEATURE_FLAGS.priceAlerts) return null;

  return (
    <button
      type="button"
      onClick={onTrack}
      className="results-tool-btn"
      title={
        signedIn
          ? "Price alerts are not saved yet — coming soon"
          : "Sign in to track prices"
      }
    >
      Track price
    </button>
  );
}

export function NearbyAirportsButton({ onBroaden }: { onBroaden?: () => void }) {
  if (!onBroaden) return null;
  return (
    <button type="button" onClick={onBroaden} className="results-tool-btn">
      Nearby airports
    </button>
  );
}

export function FlexibleDatesButton({ onFlexible }: { onFlexible?: () => void }) {
  if (!onFlexible) return null;
  return (
    <button type="button" onClick={onFlexible} className="results-tool-btn results-tool-btn--accent">
      Flexible dates
    </button>
  );
}

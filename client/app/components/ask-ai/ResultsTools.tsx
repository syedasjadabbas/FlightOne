"use client";

import { FEATURE_FLAGS } from "@/lib/ask-ai/featureFlags";

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

export function PriceInsightStub() {
  if (!FEATURE_FLAGS.priceForecast) return null;

  return (
    <div className="results-tool-panel results-tool-panel--insight">
      <p className="results-tool-panel__title">Price insight</p>
      <p className="results-tool-panel__hint">
        Price forecast will appear here when a prediction source is connected. No forecast data is available yet.
      </p>
    </div>
  );
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

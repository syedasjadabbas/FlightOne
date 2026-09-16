"use client";

import type { ReactNode } from "react";
import { RouteMotif } from "@/components/travel/TravelDoodles";
import { placeToIata } from "@/lib/inventory/places";
import type { OfferCard } from "@/lib/consultant/types";
import type { SearchResultsPanel, ResultsSortKey } from "@/lib/ask-ai/types";

/** Airline logo — same asset pattern used elsewhere in FlightOne. */
export function AirlineMark({ code, size = 32 }: { code: string; size?: number }) {
  const initials = code.slice(0, 2).toUpperCase();
  return (
    <span className="results-airline-mark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://images.kiwi.com/airlines/32/${code}.png`}
        alt=""
        width={size}
        height={size}
        className="results-airline-mark__img"
        onError={(e) => {
          e.currentTarget.hidden = true;
          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.hidden = false;
        }}
      />
      <span className="results-airline-mark__fallback" hidden aria-hidden>
        {initials}
      </span>
    </span>
  );
}

export function LiveInventoryBadge({ updating = false }: { updating?: boolean }) {
  return (
    <span className="results-live-badge" role="status">
      <span className="results-live-badge__dot" aria-hidden />
      {updating ? "Updating live inventory" : "Live inventory"}
    </span>
  );
}

export function ResultsRoutePath({
  originCode,
  destCode,
}: {
  originCode: string;
  destCode: string;
}) {
  return (
    <RouteMotif
      from={originCode}
      to={destCode}
      size="md"
      className="results-route-path fo-route-motif--results"
    />
  );
}

export function ResultsMetaLine({
  dateSpan,
  passengers,
  cabin,
}: {
  dateSpan?: string | null;
  passengers?: string | null;
  cabin?: string | null;
}) {
  const parts = [dateSpan, passengers, cabin].filter(
    (part): part is string => Boolean(part && part.trim()),
  );

  if (parts.length === 0) return null;

  return (
    <p className="results-meta-line" aria-label="Search summary">
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="results-meta-line__item">
          {i > 0 ? (
            <span className="results-meta-line__sep" aria-hidden>
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </p>
  );
}

export function resolveRouteIata(
  panel: SearchResultsPanel | null,
  offers: OfferCard[],
): { origin: string; dest: string } | null {
  const flight = offers.find((o) => o.flight)?.flight;
  if (flight?.originCode && flight?.destinationCode) {
    return { origin: flight.originCode, dest: flight.destinationCode };
  }
  const route = panel?.legRoute;
  if (!route) return null;
  const parts = route.split(/\s*[→\-–]\s*|\s+to\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const origin = placeToIata(parts[0]!) ?? parts[0]!.slice(0, 3).toUpperCase();
  const dest = placeToIata(parts[parts.length - 1]!) ?? parts[parts.length - 1]!.slice(0, 3).toUpperCase();
  return { origin, dest };
}

export function FilterGlyph({ id }: { id: string }) {
  const paths: Record<string, ReactNode> = {
    smart: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stops: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="6" cy="12" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="18" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
    airlines: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 12c4-1 7-4 10-7l2-1 1 3-3 2c-2 3-5 5-9 6l-1 3-1-3Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    times: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    duration: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    price: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    layover: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 12h6l2-4 4 8 2-4h2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    cabin: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 18h14M7 14l2-6h6l2 6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  };
  return <span className="results-filter-btn__glyph">{paths[id] ?? null}</span>;
}

export function ResultsSortSegmented({
  options,
  value,
  onChange,
}: {
  options: { id: ResultsSortKey; label: string }[];
  value: ResultsSortKey;
  onChange: (id: ResultsSortKey) => void;
}) {
  return (
    <div className="results-sort-segmented" role="tablist" aria-label="Sort results">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={`results-sort-segmented__btn${
            value === o.id ? " results-sort-segmented__btn--active" : ""
          }`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

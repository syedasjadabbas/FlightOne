"use client";

import { MessageCircle, Plane, SlidersHorizontal } from "lucide-react";

export function ResultsEmptyState({
  title = "No flights found",
  message,
  onClearFilters,
  onAskAva,
  onNearbyAirports,
  filtered = false,
}: {
  title?: string;
  message: string;
  onClearFilters?: () => void;
  onAskAva?: () => void;
  onNearbyAirports?: () => void;
  filtered?: boolean;
}) {
  return (
    <div className={`results-empty anim-state${filtered ? " results-empty--filtered" : ""}`}>
      <div
        className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--electric)_8%,white)]"
        aria-hidden
      >
        <Plane className="h-5 w-5 text-[var(--electric)]" />
      </div>
      <p className="results-empty__title">{title}</p>
      <p className="results-empty__message">{message}</p>
      {(onClearFilters || onAskAva || onNearbyAirports) && (
        <div className="results-empty__actions">
          {onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="results-empty__secondary">
              <SlidersHorizontal className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
          {onNearbyAirports ? (
            <button type="button" onClick={onNearbyAirports} className="results-empty__secondary">
              Nearby airports
            </button>
          ) : null}
          {onAskAva ? (
            <button type="button" onClick={onAskAva} className="results-empty__primary">
              <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Ask Ava
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

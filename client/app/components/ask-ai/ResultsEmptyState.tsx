"use client";

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
      <p className="results-empty__title">{title}</p>
      <p className="results-empty__message">{message}</p>
      {(onClearFilters || onAskAva || onNearbyAirports) && (
        <div className="results-empty__actions">
          {onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="results-empty__secondary">
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
              Ask Ava
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

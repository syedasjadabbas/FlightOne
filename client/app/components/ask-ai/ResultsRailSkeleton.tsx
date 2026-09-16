"use client";

import { LoadingRouteTrack } from "@/components/travel/TravelDoodles";

function Shimmer({ className }: { className: string }) {
  return <div className={`results-shimmer ${className}`} aria-hidden />;
}

function FlightRowSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flight-result-row flight-result-row--skeleton"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-hidden
    >
      <div className="flight-result-row__main">
        <div className="flight-result-row__scan">
          <div className="flight-result-row__col flight-result-row__col--airline">
            <div className="flex items-center gap-2">
              <Shimmer className="h-8 w-8 rounded-full" />
              <Shimmer className="h-3.5 w-24 rounded" />
            </div>
          </div>
          <div className="flight-result-row__col flight-result-row__col--dep">
            <Shimmer className="h-5 w-12 rounded" />
            <Shimmer className="mt-1 h-3 w-8 rounded" />
          </div>
          <div className="flight-result-row__col flight-result-row__col--mid">
            <Shimmer className="mx-auto h-3 w-10 rounded" />
            <span className="flight-result-row__line flight-result-row__line--skeleton" aria-hidden />
            <Shimmer className="mx-auto h-2.5 w-16 rounded" />
          </div>
          <div className="flight-result-row__col flight-result-row__col--arr">
            <Shimmer className="ml-auto h-5 w-12 rounded" />
            <Shimmer className="ml-auto mt-1 h-3 w-8 rounded" />
          </div>
        </div>
      </div>
      <div className="flight-result-row__aside">
        <Shimmer className="ml-auto h-3 w-14 rounded" />
        <Shimmer className="ml-auto h-6 w-24 rounded" />
        <Shimmer className="ml-auto h-8 w-[5.5rem] rounded-full" />
      </div>
    </div>
  );
}

export function ResultsRailSkeleton({
  rows = 6,
  originCode,
  destCode,
}: {
  rows?: number;
  originCode?: string;
  destCode?: string;
}) {
  const showRoute = originCode && destCode;

  return (
    <div className="results-skeleton-list" role="status" aria-label="Loading results">
      <p className="results-skeleton-status">Searching live inventory…</p>
      {showRoute ? (
        <div className="results-skeleton-route" aria-hidden>
          <LoadingRouteTrack from={originCode} to={destCode} />
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <FlightRowSkeleton key={i} index={i} />
      ))}
      <span className="sr-only">Searching live inventory…</span>
    </div>
  );
}

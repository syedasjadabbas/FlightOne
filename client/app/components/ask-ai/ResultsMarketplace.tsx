"use client";

import type { OfferCard } from "@/lib/consultant/types";
import type { SearchResultsPanel } from "@/lib/ask-ai/types";
import {
  buildDriveDiscoveryCards,
  buildExploreTiles,
  buildRelatedSearches,
  buildStayDiscoveryCards,
  deriveDestinationContext,
  realStayOffers,
} from "@/lib/ask-ai/resultsMarketplace";
import {
  DriveAroundSection,
  ExploreNearSection,
  MarketplaceDisclaimer,
  RelatedRoutesSection,
  StaysNearSection,
} from "./MarketplaceSections";

/**
 * Post-flight marketplace chrome for the full results workspace.
 * Kayak-style stays / drive / explore carousels. No site footer here — the
 * chat workspace is a focused tool surface; marketing chrome lives on /.
 * Renders priced stays only when real hotel/package offers exist.
 */
export function ResultsMarketplace({
  panel,
  offers,
  onSendFilter,
  onViewOffer,
  onClose,
}: {
  panel: SearchResultsPanel | null;
  offers: OfferCard[];
  onSendFilter?: (text: string) => void;
  onViewOffer: (offer: OfferCard) => void;
  onClose?: () => void;
}) {
  const ctx = deriveDestinationContext(panel, offers);
  const stays = realStayOffers(offers);
  const stayDiscovery = buildStayDiscoveryCards(ctx);
  const driveDiscovery = buildDriveDiscoveryCards(ctx);
  const explore = buildExploreTiles(ctx);
  const related = buildRelatedSearches(ctx);
  const city = ctx.city || "your destination";
  const dates = panel?.dateSpan ?? null;
  const canAsk = Boolean(onSendFilter);

  function ask(prompt: string) {
    onSendFilter?.(prompt);
    onClose?.();
  }

  if (!ctx.city && related.length === 0) {
    return (
      <div className="results-market">
        <MarketplaceDisclaimer />
      </div>
    );
  }

  return (
    <div className="results-market">
      {ctx.city ? (
        <>
          <StaysNearSection
            city={city}
            dates={dates}
            stays={stays}
            discovery={stayDiscovery}
            onFindStays={canAsk ? () => ask(`Add a hotel stay in ${city}`) : undefined}
            onViewOffer={onViewOffer}
            onDiscovery={ask}
            disabled={!canAsk}
          />

          <DriveAroundSection
            city={city}
            dates={dates}
            cards={driveDiscovery}
            onFindCars={canAsk ? () => ask(`Car rental in ${city}`) : undefined}
            onDiscovery={ask}
            disabled={!canAsk}
          />

          <ExploreNearSection
            city={city}
            tiles={explore}
            onSelect={ask}
            disabled={!canAsk}
          />
        </>
      ) : null}

      <RelatedRoutesSection links={related} onSelect={ask} disabled={!canAsk} />

      <MarketplaceDisclaimer />
    </div>
  );
}

/** End-of-list + load-more controls for the flight results block. */
export function FlightListContinuation({
  shown,
  total,
  onLoadMore,
  exhausted,
}: {
  shown: number;
  total: number;
  onLoadMore?: () => void;
  exhausted: boolean;
}) {
  if (total <= 0) return null;

  return (
    <div className="results-flight-continue">
      <p className="results-flight-continue__count">
        Showing {shown} of {total} {total === 1 ? "fare" : "fares"}
      </p>
      {!exhausted && onLoadMore ? (
        <button type="button" className="results-flight-continue__more" onClick={onLoadMore}>
          Load more flights
        </button>
      ) : (
        <p className="results-flight-continue__end">
          That&apos;s all the live flight options for this search.
        </p>
      )}
    </div>
  );
}

import type { ExtractedIntent, ItinerarySummary, OfferCard } from "@/lib/consultant/types";
import type { ScoredOffer } from "@/lib/recommendation/recommendation";
import { rank } from "@/lib/recommendation/recommendation";
import type { PricedOffer } from "@/lib/pricing/pricing";
import { buildFilterPills, buildQueryLabel } from "./buildFilterPills";
import type { SearchResultsPanel, SearchResultsPayload } from "./types";

const RAIL_MAX = 48;

export { RAIL_MAX };

export function buildSearchResultsPanel(args: {
  offers: OfferCard[];
  intent: ExtractedIntent;
  itineraries?: ItinerarySummary[];
  liveFlights?: boolean;
  liveHotels?: boolean;
  originPlace?: string;
  /** Full inventory count before UI cap (defaults to offers.length). */
  totalCount?: number;
  extras?: Partial<
    Pick<
      SearchResultsPanel,
      | "tripTitle"
      | "dateSpan"
      | "legRoute"
      | "multiCity"
      | "originVariants"
      | "followUpSuggestions"
      | "emptyHint"
      | "queryLabel"
    >
  >;
}): SearchResultsPanel {
  return {
    offers: args.offers,
    filterPills: buildFilterPills(args.intent),
    totalCount: args.totalCount ?? args.offers.length,
    liveFlights: args.liveFlights,
    liveHotels: args.liveHotels,
    queryLabel: args.extras?.queryLabel ?? buildQueryLabel(args.intent, args.originPlace),
    ...(args.intent.passengers != null ? { passengers: args.intent.passengers } : {}),
    ...(args.intent.cabin ? { cabin: args.intent.cabin } : {}),
    ...(args.itineraries?.length ? { itineraries: args.itineraries } : {}),
    ...(args.extras ?? {}),
  };
}

/** Build the full SERP payload emitted before the LLM reply streams. */
export function buildSearchResultsPayload(args: {
  intent: ExtractedIntent;
  exactSame: PricedOffer[];
  altSame: PricedOffer[];
  curated: ScoredOffer[];
  offers: OfferCard[];
  originPlace: string;
  liveFlights: boolean;
  liveHotels: boolean;
  meta: SearchResultsPayload["meta"];
  itineraries?: ItinerarySummary[];
}): SearchResultsPayload {
  const pool = dedupePriced([...args.exactSame, ...args.altSame]);
  const ranked =
    pool.length > 0
      ? rank(pool).slice(0, RAIL_MAX)
      : args.curated.slice(0, RAIL_MAX);

  const railOffers =
    ranked.length > 0
      ? args.offers.length > 0 &&
        ranked.every((s) => args.offers.some((o) => o.id === s.priced.offer.id))
        ? args.offers.filter((o) => ranked.some((s) => s.priced.offer.id === o.id))
        : ranked.map((s) => findOfferCard(s, args.offers))
      : args.offers;

  return {
    panel: buildSearchResultsPanel({
      offers: railOffers,
      intent: args.intent,
      itineraries: args.itineraries,
      liveFlights: args.liveFlights,
      liveHotels: args.liveHotels,
      originPlace: args.originPlace,
    }),
    intent: args.intent,
    meta: args.meta,
  };
}

function dedupePriced(pool: PricedOffer[]): PricedOffer[] {
  const seen = new Set<string>();
  return pool.filter((p) => {
    if (seen.has(p.offer.id)) return false;
    seen.add(p.offer.id);
    return true;
  });
}

function findOfferCard(scored: ScoredOffer, cards: OfferCard[]): OfferCard {
  const hit = cards.find((c) => c.id === scored.priced.offer.id);
  if (hit) return hit;
  const p = scored.priced;
  return {
    id: p.offer.id,
    type: p.offer.type,
    angle: scored.angle,
    title: p.offer.id,
    subtitle: "",
    price: "",
    priceMinor: p.customerPrice.amount,
    currency: p.customerPrice.currency,
    marketPrice: null,
    savingsPct: null,
    reasons: scored.reasons,
    badges: [],
    unitsLeft: 99,
  };
}

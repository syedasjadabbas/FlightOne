import type {
  ConsultantResponse,
  ExtractedIntent,
  ItinerarySummary,
  OfferCard,
} from "@/lib/consultant/types";
import type { OfferType } from "@/lib/inventory/types";

/** NL-derived or user-toggled constraint chip above the results rail. */
export type FilterPillKind =
  | "nonstop"
  | "max_stops"
  | "airline"
  | "refundable"
  | "checked_bag"
  | "depart_after"
  | "depart_before"
  | "max_layover"
  | "stars"
  | "budget"
  | "type"
  | "dates";

/** Where the pill originated — NL extraction vs manual panel toggle. */
export type FilterPillSource = "nl" | "manual";

export interface FilterPill {
  id: string;
  label: string;
  kind: FilterPillKind;
  active: boolean;
  source: FilterPillSource;
  /** Kind-specific payload — IATA code, stop count, min stars, or OfferType. */
  value?: string | number;
}

export type ResultsSortKey = "price" | "duration" | "score" | "angle";

/** SSE / hook phase for the results rail loading states. */
export type SearchPhase = "idle" | "extract" | "search" | "reply" | "done";

/** One origin variant when comparing LHE vs ISB on the same multi-city route. */
export interface OriginVariantPanel {
  originIata: string;
  originLabel: string;
  legRoute: string;
  offers: OfferCard[];
  totalCount: number;
  emptyMessage?: string;
}

/** Per-leg GDS search block when a full itinerary cannot be assembled. */
export interface LegSearchPanel {
  legRoute: string;
  stageLabel?: string;
  offers: OfferCard[];
  totalCount: number;
  live: boolean;
  /** Google Flights market reference — indicative, not bookable via GDS. */
  web?: boolean;
  emptyMessage?: string;
}

/** Full SERP payload for the KAYAK-style results rail (prices always from inventory). */
export interface SearchResultsPanel {
  offers: OfferCard[];
  itineraries?: ItinerarySummary[];
  filterPills: FilterPill[];
  totalCount: number;
  liveFlights?: boolean;
  liveHotels?: boolean;
  /** Human-readable summary of the active search (e.g. "LHE → DXB · 2 travellers"). */
  queryLabel?: string;
  /** Auto title from legs — e.g. "Multi-City Fare Compare". */
  tripTitle?: string;
  /** Trip span ribbon — e.g. "Oct 5 – Oct 25". */
  dateSpan?: string;
  /** Full leg chain — e.g. "LHE → LON → NYC → MIA → LHE". */
  legRoute?: string;
  multiCity?: boolean;
  originVariants?: OriginVariantPanel[];
  /** Stacked leg blocks when GDS returned partial inventory (KAYAK dual-panel pattern). */
  legPanels?: LegSearchPanel[];
  /** Contextual follow-up chips shown under the assistant reply. */
  followUpSuggestions?: string[];
  emptyHint?: string;
  /** Traveller count from the active search intent. */
  passengers?: number;
  /** Cabin preference from the active search intent. */
  cabin?: "economy" | "premium" | "business";
}

/** Stream / API envelope for the results rail beside chat. */
export interface SearchResultsPayload {
  panel: SearchResultsPanel;
  intent: ExtractedIntent;
  meta: ConsultantResponse["meta"];
}

export type { OfferType };

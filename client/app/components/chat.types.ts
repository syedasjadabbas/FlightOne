import type { TravellerLocation } from "@/lib/geo/types";
import type {
  FilterPill,
  ResultsSortKey,
  SearchPhase,
  SearchResultsPanel,
} from "@/lib/ask-ai/types";
import type { SidebarFilterFacets, SidebarFilterState } from "@/lib/ask-ai/sidebarFilters";
import type { LoadingRouteCodes } from "@/lib/ask-ai/loadingRoute";
import type { ItinerarySummary, OfferCard } from "@/lib/consultant/types";

/** Text-only chat message — inventory lives in the results rail. */
export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
}

export interface AskAiChatResult {
  messages: UiMessage[];
  busy: boolean;
  provider: string | null;
  send: (text: string) => void;
  searchPanel: SearchResultsPanel | null;
  searchPhase: SearchPhase;
  /** Assistant message id bound to the latest completed live search (if any). */
  searchResultMessageId: string | null;
  filterPills: FilterPill[];
  sortKey: ResultsSortKey;
  displayedOffers: OfferCard[];
  displayedItineraries: ItinerarySummary[];
  sidebarFilters: SidebarFilterState | null;
  sidebarFacets: SidebarFilterFacets | null;
  activeOriginIdx: number;
  onOriginChange: (idx: number) => void;
  followUpSuggestions: string[];
  onTogglePill: (pillId: string) => void;
  onSidebarFiltersChange: (next: SidebarFilterState) => void;
  onClearSidebarFilters: () => void;
  onSortChange: (sort: ResultsSortKey) => void;
  onTripTitleChange: (title: string) => void;
  /** Active search route for loading UI (IATA codes). */
  loadingRoute: LoadingRouteCodes | null;
  /** Server conversation id when authenticated (Module 04 feedback attribution). */
  conversationId: string | null;
  /** Load a prior authenticated conversation by id (history picker). */
  resumeConversationById: (id: string) => Promise<boolean>;
  /** Clear active thread context and start a brand-new conversation. */
  startNewChat: () => void;
}

export function buildGreeting(location?: TravellerLocation | null): UiMessage {
  const city = location?.place || location?.city || "your city";
  const from = city === "your city" ? "your city" : city;
  return {
    id: "greet",
    role: "assistant",
    content: `Hi — I can search flights and stays from ${from}. Tell me the trip you have in mind.`,
  };
}

export const GREETING: UiMessage = buildGreeting(null);

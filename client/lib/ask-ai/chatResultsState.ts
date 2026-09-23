import type { SearchPhase, SearchResultsPanel } from "./types";

/** Chat-side lifecycle for the results CTA — not the results page layout. */
export type ChatResultsState = "idle" | "searching" | "results" | "empty";

export function isLiveSearchPanel(panel: SearchResultsPanel | null | undefined): boolean {
  return panel?.liveFlights === true || panel?.liveHotels === true;
}

export function countPanelInventory(
  panel: SearchResultsPanel | null | undefined,
  activeOriginIdx = 0,
): number {
  if (!panel) return 0;
  const variant = panel.originVariants?.[activeOriginIdx];
  return Math.max(
    variant?.offers?.length ?? 0,
    variant?.totalCount ?? 0,
    panel.offers?.length ?? 0,
    panel.totalCount ?? 0,
    panel.itineraries?.length ?? 0,
  );
}

/** Whether the dedicated results workspace should stay mounted / reachable. */
export function canShowResultsWorkspace(args: {
  searchPanel: SearchResultsPanel | null;
  resultCount: number;
  busy: boolean;
  searchPhase: SearchPhase;
}): boolean {
  if (args.busy) return false;
  if (!isLiveSearchPanel(args.searchPanel)) return false;
  return args.resultCount > 0;
}

/**
 * Derive CTA state for the latest assistant message.
 * Follow-up / clarify turns must stay idle (no View results).
 */
export function deriveChatResultsState(args: {
  busy: boolean;
  searchPhase: SearchPhase;
  searchPanel: SearchResultsPanel | null;
  resultCount: number;
  searchResultMessageId: string | null;
  latestAssistantId: string | null;
}): ChatResultsState {
  if (args.busy && args.searchPhase === "search") return "searching";
  if (args.busy) return "idle";

  if (
    args.searchResultMessageId &&
    args.latestAssistantId !== args.searchResultMessageId
  ) {
    return "idle";
  }

  if (!isLiveSearchPanel(args.searchPanel)) return "idle";

  if (args.resultCount > 0) return "results";
  return "empty";
}

/**
 * Resolve IATA origin/destination for loading UI from travel-plan state.
 * Read-only preview — does not change search or merge behavior.
 */
import type { ChatTurn } from "@/lib/llm";
import { firstFlightQuery, mergeTravelPlan } from "@/lib/consultant/mergeTravelPlan";
import { extractTravelPlanDeterministic } from "@/lib/consultant/extractTravelPlanDeterministic";
import type { TravelPlan } from "@/lib/consultant/travelPlan";

export type LoadingRouteCodes = {
  origin: string;
  destination: string;
};

export function routeCodesFromTravelPlan(
  plan: TravelPlan | null | undefined,
): LoadingRouteCodes | null {
  const q = firstFlightQuery(plan ?? null);
  if (!q?.origin || !q?.destination) return null;
  return {
    origin: q.origin.toUpperCase(),
    destination: q.destination.toUpperCase(),
  };
}

export type PreviewLoadingRouteOpts = {
  today: string;
  defaultOriginIata: string;
  defaultOriginPlace: string;
  history: ChatTurn[];
  previousPlan: TravelPlan | null;
};

/**
 * Client-side preview of the active search route for the loading bubble.
 * Uses the same merge/deterministic helpers as the backend (read-only).
 */
export function previewLoadingRoute(
  message: string,
  opts: PreviewLoadingRouteOpts,
): LoadingRouteCodes | null {
  const det = extractTravelPlanDeterministic(message, {
    today: opts.today,
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
    previousPlan: opts.previousPlan,
    history: opts.history,
  });

  const incoming: TravelPlan | null =
    det.kind === "plan"
      ? det.plan
      : det.kind === "clarify"
        ? det.plan
        : null;

  const merged = mergeTravelPlan(incoming, {
    message,
    history: opts.history,
    today: opts.today,
    defaultOriginIata: opts.defaultOriginIata,
    defaultOriginPlace: opts.defaultOriginPlace,
    previousPlan: opts.previousPlan,
  });

  return routeCodesFromTravelPlan(merged);
}

import type { OfferCard } from "@/lib/consultant/types";
import type { RecommendationFeedbackContext } from "@/lib/api/recommendations.api";
import type { RecommendationFeedbackSignal } from "@/lib/recommendation/learning";

/**
 * Build learning context from real offer fields only — never invent attributes.
 * Empty context is allowed by the API but will not move learned weights.
 */
export function feedbackContextFromOffer(
  offer: OfferCard,
): RecommendationFeedbackContext | undefined {
  const flight = offer.flight;
  if (!flight) return undefined;

  const context: RecommendationFeedbackContext = {};
  const code = flight.airlineCode?.trim();
  if (code) context.airlineCode = code.toUpperCase().slice(0, 10);
  if (typeof flight.stops === "number" && Number.isFinite(flight.stops)) {
    context.stops = Math.max(0, Math.min(9, Math.trunc(flight.stops)));
  }
  if (typeof flight.refundable === "boolean") {
    context.refundable = flight.refundable;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

export type FeedbackUiPhase =
  | "idle"
  | "submitting"
  | "saved_accept"
  | "saved_reject"
  | "error";

/** Block further clicks once a signal is saved or a request is in flight. */
export function canSubmitRecommendationFeedback(
  phase: FeedbackUiPhase,
  _signal: Extract<RecommendationFeedbackSignal, "ACCEPT" | "REJECT">,
): boolean {
  return phase === "idle" || phase === "error";
}

export function phaseAfterSuccessfulFeedback(
  signal: Extract<RecommendationFeedbackSignal, "ACCEPT" | "REJECT">,
): FeedbackUiPhase {
  return signal === "ACCEPT" ? "saved_accept" : "saved_reject";
}

export function feedbackStatusCopy(phase: FeedbackUiPhase): string | null {
  switch (phase) {
    case "submitting":
      return "Saving preference…";
    case "saved_accept":
      return "Preference saved — we'll lean this way next time.";
    case "saved_reject":
      return "Preference saved — we'll lean away from this next time.";
    case "error":
      return "Could not save preference. Try again.";
    default:
      return null;
  }
}

export function buildRecommendationFeedbackBody(input: {
  offer: OfferCard;
  signal: Extract<RecommendationFeedbackSignal, "ACCEPT" | "REJECT">;
  conversationId?: string | null;
}): {
  offerId: string;
  signal: "ACCEPT" | "REJECT";
  conversationId?: string;
  context?: RecommendationFeedbackContext;
} {
  const context = feedbackContextFromOffer(input.offer);
  return {
    offerId: input.offer.id,
    signal: input.signal,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(context ? { context } : {}),
  };
}

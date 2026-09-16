"use client";

import { useState } from "react";
import type { OfferCard } from "@/lib/consultant/types";
import { useAuthStore } from "@/store/auth.store";
import { useRecordRecommendationFeedbackMutation } from "@/lib/api/recommendations.api";
import {
  buildRecommendationFeedbackBody,
  canSubmitRecommendationFeedback,
  feedbackStatusCopy,
  phaseAfterSuccessfulFeedback,
  type FeedbackUiPhase,
} from "@/lib/recommendation/feedbackPayload";

/**
 * Explicit ACCEPT / REJECT controls for Module 04 preference learning.
 * Persists via RTK → POST /recommendations/feedback. Guests see a sign-in hint.
 */
export function OfferFeedbackControls({
  offer,
  conversationId,
}: {
  offer: OfferCard;
  conversationId?: string | null;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [recordFeedback, { isLoading }] = useRecordRecommendationFeedbackMutation();
  const [phase, setPhase] = useState<FeedbackUiPhase>("idle");

  if (hasHydrated && !accessToken) {
    return (
      <p className="offer-feedback offer-feedback--guest">
        <a href={`/login?redirect=${encodeURIComponent("/chat")}`} className="offer-feedback__signin">
          Sign in
        </a>{" "}
        to save recommendation preferences.
      </p>
    );
  }

  if (!hasHydrated) {
    return null;
  }

  const status = feedbackStatusCopy(isLoading ? "submitting" : phase);
  const locked = !canSubmitRecommendationFeedback(phase, "ACCEPT") || isLoading;

  async function submit(signal: "ACCEPT" | "REJECT") {
    if (!canSubmitRecommendationFeedback(phase, signal) || isLoading) return;
    setPhase("submitting");
    try {
      await recordFeedback(
        buildRecommendationFeedbackBody({
          offer,
          signal,
          conversationId,
        }),
      ).unwrap();
      setPhase(phaseAfterSuccessfulFeedback(signal));
    } catch {
      setPhase("error");
    }
  }

  return (
    <div className="offer-feedback" role="group" aria-label="Recommendation preference">
      <div className="offer-feedback__actions">
        <button
          type="button"
          className="offer-feedback__btn offer-feedback__btn--accept"
          disabled={locked}
          aria-pressed={phase === "saved_accept"}
          onClick={() => void submit("ACCEPT")}
        >
          Looks good
        </button>
        <button
          type="button"
          className="offer-feedback__btn offer-feedback__btn--reject"
          disabled={locked}
          aria-pressed={phase === "saved_reject"}
          onClick={() => void submit("REJECT")}
        >
          Not for me
        </button>
      </div>
      {status ? (
        <p
          className={
            phase === "error"
              ? "offer-feedback__status offer-feedback__status--error"
              : "offer-feedback__status"
          }
          role={phase === "error" ? "alert" : "status"}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

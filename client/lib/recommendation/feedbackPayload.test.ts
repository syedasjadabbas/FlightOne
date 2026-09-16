import { describe, expect, it } from "vitest";
import type { OfferCard } from "@/lib/consultant/types";
import {
  buildRecommendationFeedbackBody,
  canSubmitRecommendationFeedback,
  feedbackContextFromOffer,
  feedbackStatusCopy,
  phaseAfterSuccessfulFeedback,
} from "@/lib/recommendation/feedbackPayload";

function flightOffer(overrides: Partial<OfferCard> = {}): OfferCard {
  return {
    id: "offer-ey-1",
    type: "flight",
    angle: "best_value",
    title: "EY LHE→DXB",
    subtitle: "Nonstop",
    score: 90,
    price: "USD 350.00",
    priceMinor: 35000,
    currency: "USD",
    marketPrice: null,
    savingsPct: null,
    reasons: [],
    badges: [],
    flight: {
      airline: "Etihad",
      airlineCode: "ey",
      originCode: "LHE",
      destinationCode: "DXB",
      originCity: "Lahore",
      destinationCity: "Dubai",
      departTimeLocal: "09:00",
      arriveTimeLocal: "11:30",
      durationMinutes: 210,
      stops: 0,
      cabin: "economy",
      refundable: true,
    },
    ...overrides,
  };
}

describe("recommendation feedback payload", () => {
  it("builds ACCEPT body with real offer context for the feedback endpoint", () => {
    const body = buildRecommendationFeedbackBody({
      offer: flightOffer(),
      signal: "ACCEPT",
      conversationId: "conv-1",
    });
    expect(body).toEqual({
      offerId: "offer-ey-1",
      signal: "ACCEPT",
      conversationId: "conv-1",
      context: {
        airlineCode: "EY",
        stops: 0,
        refundable: true,
      },
    });
  });

  it("builds REJECT body without inventing missing conversationId", () => {
    const body = buildRecommendationFeedbackBody({
      offer: flightOffer({ id: "offer-pk-2" }),
      signal: "REJECT",
      conversationId: null,
    });
    expect(body.signal).toBe("REJECT");
    expect(body.offerId).toBe("offer-pk-2");
    expect(body).not.toHaveProperty("conversationId");
    expect(body.context?.airlineCode).toBe("EY");
  });

  it("omits context when offer has no flight attributes (no fabrication)", () => {
    const hotel: OfferCard = {
      id: "hotel-1",
      type: "hotel",
      angle: "recommended",
      title: "Hotel",
      subtitle: "DXB",
      score: 70,
      price: "USD 100.00",
      priceMinor: 10000,
      currency: "USD",
      marketPrice: null,
      savingsPct: null,
      reasons: [],
      badges: [],
    };
    expect(feedbackContextFromOffer(hotel)).toBeUndefined();
    const body = buildRecommendationFeedbackBody({
      offer: hotel,
      signal: "ACCEPT",
    });
    expect(body).not.toHaveProperty("context");
  });

  it("prevents duplicate submission after a successful save", () => {
    expect(canSubmitRecommendationFeedback("idle", "ACCEPT")).toBe(true);
    expect(canSubmitRecommendationFeedback("error", "REJECT")).toBe(true);
    expect(canSubmitRecommendationFeedback("submitting", "ACCEPT")).toBe(false);
    expect(canSubmitRecommendationFeedback("saved_accept", "ACCEPT")).toBe(false);
    expect(canSubmitRecommendationFeedback("saved_accept", "REJECT")).toBe(false);
    expect(canSubmitRecommendationFeedback("saved_reject", "ACCEPT")).toBe(false);
  });

  it("does not claim success when phase is error", () => {
    expect(feedbackStatusCopy("error")).toMatch(/Could not save/i);
    expect(feedbackStatusCopy("saved_accept")).toMatch(/Preference saved/i);
    expect(phaseAfterSuccessfulFeedback("ACCEPT")).toBe("saved_accept");
    expect(phaseAfterSuccessfulFeedback("REJECT")).toBe("saved_reject");
  });
});

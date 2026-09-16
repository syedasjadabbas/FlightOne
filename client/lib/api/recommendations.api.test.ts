import { describe, expect, it } from "vitest";
import { recommendationsApi } from "@/lib/api/recommendations.api";
import { buildRecommendationFeedbackBody } from "@/lib/recommendation/feedbackPayload";
import {
  RECOMMENDATION_FEEDBACK_PATH,
  RECOMMENDATION_LEARNED_PATH,
} from "@/lib/recommendation/recommendation";
import type { OfferCard } from "@/lib/consultant/types";

const sampleOffer: OfferCard = {
  id: "offer-1",
  type: "flight",
  angle: "best_value",
  title: "EY",
  subtitle: "LHE-DXB",
  score: 90,
  price: "USD 100.00",
  priceMinor: 10000,
  currency: "USD",
  marketPrice: null,
  savingsPct: null,
  reasons: [],
  badges: [],
  flight: {
    airline: "Etihad",
    airlineCode: "EY",
    originCode: "LHE",
    destinationCode: "DXB",
    originCity: "Lahore",
    destinationCity: "Dubai",
    departTimeLocal: "09:00",
    arriveTimeLocal: "11:00",
    durationMinutes: 180,
    stops: 0,
    cabin: "economy",
    refundable: false,
  },
};

describe("recommendations.api", () => {
  it("registers feedback + learned endpoints on baseApi", () => {
    const endpoints = Object.keys(recommendationsApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "recordRecommendationFeedback",
        "getLearnedPreferences",
      ]),
    );
  });

  it("targets the existing Module 04 feedback and learned paths", () => {
    expect(RECOMMENDATION_FEEDBACK_PATH).toBe("/recommendations/feedback");
    expect(RECOMMENDATION_LEARNED_PATH).toBe("/recommendations/learned");
  });

  it("ACCEPT body is shaped for POST /recommendations/feedback", () => {
    const body = buildRecommendationFeedbackBody({
      offer: sampleOffer,
      signal: "ACCEPT",
      conversationId: "c1",
    });
    expect(body.signal).toBe("ACCEPT");
    expect(body.offerId).toBe("offer-1");
    expect(body.conversationId).toBe("c1");
    expect(body.context).toEqual({
      airlineCode: "EY",
      stops: 0,
      refundable: false,
    });
  });

  it("REJECT body is shaped for the same feedback endpoint", () => {
    const body = buildRecommendationFeedbackBody({
      offer: sampleOffer,
      signal: "REJECT",
    });
    expect(body.signal).toBe("REJECT");
    expect(body.offerId).toBe("offer-1");
  });
});

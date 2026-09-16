/**
 * Module 04 — Recommendation feedback + learned prefs (RTK Query).
 * Server: POST /recommendations/feedback, GET /recommendations/learned.
 */
import { baseApi } from "@/lib/api/baseApi";
import type { RecommendationFeedbackSignal } from "@/lib/recommendation/learning";

export type RecommendationFeedbackContext = {
  airlineCode?: string;
  stops?: number;
  refundable?: boolean;
};

export type RecordRecommendationFeedbackBody = {
  offerId: string;
  signal: RecommendationFeedbackSignal;
  conversationId?: string;
  context?: RecommendationFeedbackContext;
};

export type RecommendationFeedbackRecord = {
  id: string;
  userId: string;
  offerId: string;
  conversationId: string | null;
  signal: RecommendationFeedbackSignal;
  context: RecommendationFeedbackContext | null;
  createdAt: string;
};

export type LearnedPreferencesDto = {
  airlineLean: Record<string, number>;
  preferRefundable: boolean;
  preferNonstop: boolean;
  sampleCount: number;
};

export const recommendationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    recordRecommendationFeedback: build.mutation<
      RecommendationFeedbackRecord,
      RecordRecommendationFeedbackBody
    >({
      query: (body) => ({
        url: "/recommendations/feedback",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Recommendations"],
    }),
    getLearnedPreferences: build.query<LearnedPreferencesDto, void>({
      query: () => "/recommendations/learned",
      providesTags: ["Recommendations"],
    }),
  }),
});

export const {
  useRecordRecommendationFeedbackMutation,
  useGetLearnedPreferencesQuery,
} = recommendationsApi;

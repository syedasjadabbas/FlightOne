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

export type PredictiveRecommendation = {
  id: string;
  kind: string;
  title: string;
  reason: string;
  hedge: string;
  origin: string | null;
  destination: string | null;
  searchPrompt: string;
  confidence: string;
  sources: Array<{ type: string; count?: number; route?: string }>;
  cabinHint?: string | null;
};

export type PredictiveList = {
  items: PredictiveRecommendation[];
  emptyReason: string | null;
  calendar: { configured: boolean; available: boolean; reason: string | null };
  preferences: {
    proactiveEnabled: boolean;
    notifyApp: boolean;
    notifyEmail: boolean;
  };
};

export type FareInsight = {
  origin: string;
  destination: string;
  departureDate: string | null;
  currentFare: {
    available: boolean;
    amountMinor: number | null;
    currency: string | null;
    source: string | null;
  };
  prediction: {
    available: boolean;
    status: string;
    trend: string | null;
    suggestedAction: string;
    confidence: { level: string; quality: string; sampleCount: number };
    historicalMedianMinor: number | null;
    sampleCount: number;
    explanation: string;
  };
  privateHistoryUsed: boolean;
  autoBooked: boolean;
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
    getPredictiveRecommendations: build.query<PredictiveList, void>({
      query: () => "/recommendations/predictive",
      providesTags: ["Recommendations"],
    }),
    dismissPredictiveRecommendation: build.mutation<{ dismissed: boolean; id: string }, { id: string }>({
      query: (body) => ({
        url: "/recommendations/predictive/dismiss",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Recommendations"],
    }),
    getPredictivePreferences: build.query<
      { proactiveEnabled: boolean; notifyApp: boolean; notifyEmail: boolean },
      void
    >({
      query: () => "/recommendations/predictive/preferences",
      providesTags: ["Recommendations"],
    }),
    patchPredictivePreferences: build.mutation<
      { proactiveEnabled: boolean; notifyApp: boolean; notifyEmail: boolean },
      { proactiveEnabled?: boolean; notifyApp?: boolean; notifyEmail?: boolean }
    >({
      query: (body) => ({
        url: "/recommendations/predictive/preferences",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Recommendations"],
    }),
    getFareInsight: build.mutation<
      FareInsight,
      {
        origin: string;
        destination: string;
        departureDate?: string;
        currentAmountMinor?: number;
        currency?: string;
      }
    >({
      query: (body) => ({
        url: "/recommendations/fare-insight",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useRecordRecommendationFeedbackMutation,
  useGetLearnedPreferencesQuery,
  useGetPredictiveRecommendationsQuery,
  useDismissPredictiveRecommendationMutation,
  useGetPredictivePreferencesQuery,
  usePatchPredictivePreferencesMutation,
  useGetFareInsightMutation,
} = recommendationsApi;

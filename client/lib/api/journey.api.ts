/**
 * Module 09 — Live Journey Management API (authenticated).
 */
import { baseApi } from "@/lib/api/baseApi";

export type JourneyFeedCapability = {
  provider: string;
  configured: boolean;
  canPollLive: boolean;
  reasons?: string[];
};

export type JourneyWatch = {
  id: string;
  bookingId: string;
  userId: string;
  status: string;
  flightNumber: string | null;
  departAt: string | null;
  arriveAt: string | null;
  lastPolledAt: string | null;
  metadata: Record<string, unknown> | null;
};

export const journeyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getJourneyCapability: build.query<
      JourneyFeedCapability & {
        flightStatus?: JourneyFeedCapability;
        weather?: JourneyFeedCapability;
        hotel?: JourneyFeedCapability;
        transfer?: JourneyFeedCapability;
        immigration?: JourneyFeedCapability;
        deferredFeeds?: string[];
        notificationChannels?: string[];
      },
      void
    >({
      query: () => "/journey/capability",
      providesTags: ["Journey"],
    }),
    listJourneyWatches: build.query<
      { items: JourneyWatch[]; total: number },
      { page?: number; pageSize?: number } | void
    >({
      query: (params) => ({
        url: "/journey/watches",
        params: params || undefined,
      }),
      providesTags: ["Journey"],
    }),
    pollJourneyWatch: build.mutation<Record<string, unknown>, string>({
      query: (id) => ({ url: `/journey/watches/${id}/poll`, method: "POST" }),
      invalidatesTags: ["Journey"],
    }),
    journeyAlternatives: build.mutation<
      { offers: Array<{ supplierOfferSnapshotId?: string; [k: string]: unknown }>; autoBooked: boolean; note?: string },
      string
    >({
      query: (id) => ({
        url: `/journey/watches/${id}/alternatives`,
        method: "POST",
      }),
    }),
    journeyRebookHandoff: build.mutation<
      { autoBooked: boolean; charged: boolean; action: string; message?: string },
      { id: string; supplierOfferSnapshotId: string }
    >({
      query: ({ id, supplierOfferSnapshotId }) => ({
        url: `/journey/watches/${id}/rebook-handoff`,
        method: "POST",
        body: { supplierOfferSnapshotId },
      }),
    }),
    escalateJourney: build.mutation<
      { trigger: string; auditOnly?: boolean },
      { id: string; conversationId?: string; reason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/journey/watches/${id}/escalate`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetJourneyCapabilityQuery,
  useListJourneyWatchesQuery,
  usePollJourneyWatchMutation,
  useJourneyAlternativesMutation,
  useJourneyRebookHandoffMutation,
  useEscalateJourneyMutation,
} = journeyApi;

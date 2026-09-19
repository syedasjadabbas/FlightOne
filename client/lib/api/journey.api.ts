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

export type JourneyPhase = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "UNKNOWN";

export type JourneyEvent = {
  id: string;
  watchId: string;
  type: string;
  severity: number;
  title: string;
  body?: string | null;
  fingerprint?: string | null;
  payload?: Record<string, unknown> | null;
  notifiedAt?: string | null;
  createdAt: string;
};

export type JourneyItineraryItem = {
  kind: "FLIGHT" | "HOTEL" | "TRANSFER" | string;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  departAt?: string | null;
  arriveAt?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  confirmationRef?: string | null;
  transferRef?: string | null;
  pickupAt?: string | null;
};

export type JourneyLiveFlight = {
  confirmed: boolean;
  dataStatus: string;
  snapshot: {
    status?: string | null;
    gate?: string | null;
    terminal?: string | null;
    minutesDelayed?: number | null;
    [key: string]: unknown;
  } | null;
  reason?: string | null;
};

export type JourneyWatch = {
  id: string;
  bookingId: string;
  userId: string;
  status: string;
  phase?: JourneyPhase;
  flightNumber: string | null;
  departAt: string | null;
  arriveAt: string | null;
  lastPolledAt: string | null;
  metadata: Record<string, unknown> | null;
  booking?: {
    id: string;
    status: string;
    product: string;
    ticketRef?: string | null;
  } | null;
  itinerary?: JourneyItineraryItem[];
  events?: JourneyEvent[];
  disruptions?: JourneyEvent[];
  liveFlight?: JourneyLiveFlight;
  ancillaryAvailability?: {
    weather?: string;
    hotel?: string;
    transfer?: string;
    immigration?: string;
  };
};

export type JourneyCapability = JourneyFeedCapability & {
  flightStatus?: JourneyFeedCapability;
  weather?: JourneyFeedCapability;
  hotel?: JourneyFeedCapability;
  transfer?: JourneyFeedCapability;
  immigration?: JourneyFeedCapability;
  deferredFeeds?: string[];
  notificationChannels?: string[];
};

export const journeyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getJourneyCapability: build.query<JourneyCapability, void>({
      query: () => "/journey/capability",
      providesTags: ["Journey"],
    }),
    listJourneyWatches: build.query<
      { items: JourneyWatch[]; total: number; capability?: JourneyCapability },
      { page?: number; pageSize?: number; sync?: boolean } | void
    >({
      query: (params) => ({
        url: "/journey/watches",
        params: params || undefined,
      }),
      providesTags: ["Journey"],
    }),
    getJourneyWatch: build.query<JourneyWatch, string>({
      query: (id) => `/journey/watches/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Journey", id }],
    }),
    listJourneyEvents: build.query<{ items: JourneyEvent[]; total: number }, string>({
      query: (id) => `/journey/watches/${id}/events`,
      providesTags: (_r, _e, id) => [{ type: "Journey", id: `events-${id}` }],
    }),
    pollJourneyWatch: build.mutation<
      {
        dataStatus?: string;
        isFact?: boolean;
        reason?: string;
        ancillary?: Record<string, string | null>;
        events?: JourneyEvent[];
        watch?: JourneyWatch;
        provider?: JourneyCapability;
      },
      string
    >({
      query: (id) => ({ url: `/journey/watches/${id}/poll`, method: "POST" }),
      invalidatesTags: ["Journey"],
    }),
    journeyAlternatives: build.mutation<
      {
        offers: Array<{ supplierOfferSnapshotId?: string; [k: string]: unknown }>;
        autoBooked: boolean;
        note?: string;
        available?: boolean;
        reason?: string;
      },
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
      { trigger: string; auditOnly?: boolean; message?: string },
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
  useGetJourneyWatchQuery,
  useListJourneyEventsQuery,
  usePollJourneyWatchMutation,
  useJourneyAlternativesMutation,
  useJourneyRebookHandoffMutation,
  useEscalateJourneyMutation,
} = journeyApi;

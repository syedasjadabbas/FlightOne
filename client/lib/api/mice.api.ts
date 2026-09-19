/**
 * Module 12 — MICE API.
 */
import { baseApi } from "@/lib/api/baseApi";

export type MiceEventType = "MEETING" | "INCENTIVE" | "CONFERENCE" | "EXHIBITION";
export type MiceTransferDirection = "AIRPORT_PICKUP" | "AIRPORT_DROPOFF";
export type MiceTransferStatus =
  | "REQUESTED"
  | "PROVIDER_UNCONFIGURED"
  | "DATA_UNAVAILABLE"
  | "CONFIRMED"
  | "FAILED";

export type MiceEvent = {
  id: string;
  name: string;
  type: MiceEventType;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  budgetMinor: number | null;
  currency: string | null;
  groupId: string | null;
  myRole?: string;
};

export type MiceEnquiryStatus = "SUBMITTED" | "IN_REVIEW" | "CANCELLED";

export type MiceEventEnquiry = {
  id: string;
  createdByUserId: string;
  eventId: string | null;
  companyId: string | null;
  name: string;
  type: MiceEventType;
  status: MiceEnquiryStatus;
  organization: string | null;
  destination: string;
  origin: string | null;
  venue: string | null;
  eventStartsAt: string;
  eventEndsAt: string;
  travelStartsAt: string | null;
  travelEndsAt: string | null;
  attendeeCount: number;
  budgetMinor: number | null;
  currency: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  flightsRequired: boolean;
  hotelsRequired: boolean;
  transfersRequired: boolean;
  meetingSpaceRequired: boolean;
  cateringRequired: boolean;
  visaAssistanceRequired: boolean;
  accommodationNotes: string | null;
  transportNotes: string | null;
  flightNotes: string | null;
  meetingNotes: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  fulfilment?: string;
  fulfilmentNote?: string;
  event?: MiceEvent | null;
};

export type CreateMiceEnquiryBody = {
  name: string;
  type: MiceEventType;
  organization?: string;
  destination: string;
  origin?: string;
  venue?: string;
  eventStartsAt: string;
  eventEndsAt: string;
  travelStartsAt?: string;
  travelEndsAt?: string;
  attendeeCount: number;
  budgetMinor?: number;
  currency?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  flightsRequired?: boolean;
  hotelsRequired?: boolean;
  transfersRequired?: boolean;
  meetingSpaceRequired?: boolean;
  cateringRequired?: boolean;
  visaAssistanceRequired?: boolean;
  accommodationNotes?: string;
  transportNotes?: string;
  flightNotes?: string;
  meetingNotes?: string;
  notes?: string;
  idempotencyKey?: string;
};

export type MiceTransfer = {
  id: string;
  eventId: string;
  label: string;
  direction: MiceTransferDirection;
  passengerCount: number;
  airportCode?: string | null;
  flightRef?: string | null;
  flightBookingId?: string | null;
  pickupAt?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  notes?: string | null;
  status: MiceTransferStatus;
  providerStatus?: string | null;
  providerReason?: string | null;
  transferRef?: string | null;
  delegateId?: string | null;
  flightLinkage?: Record<string, unknown> | null;
  liveTransferStatus?: Record<string, unknown> | null;
  provider?: {
    book?: { configured?: boolean; canBookLive?: boolean; provider?: string; reasons?: string[] };
  };
};

export const miceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMiceEvents: build.query<MiceEvent[], void>({
      query: () => "/mice/events",
      providesTags: ["Mice"],
    }),
    listMiceEnquiries: build.query<{ items: MiceEventEnquiry[] }, void>({
      query: () => "/mice/enquiries",
      providesTags: ["Mice"],
    }),
    getMiceEnquiry: build.query<MiceEventEnquiry, string>({
      query: (enquiryId) => `/mice/enquiries/${enquiryId}`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id: `enquiry-${id}` }],
    }),
    createMiceEnquiry: build.mutation<MiceEventEnquiry, CreateMiceEnquiryBody>({
      query: (body) => ({ url: "/mice/enquiries", method: "POST", body }),
      invalidatesTags: ["Mice"],
    }),
    updateMiceEnquiry: build.mutation<
      MiceEventEnquiry,
      { enquiryId: string; body: Partial<CreateMiceEnquiryBody> }
    >({
      query: ({ enquiryId, body }) => ({
        url: `/mice/enquiries/${enquiryId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    cancelMiceEnquiry: build.mutation<MiceEventEnquiry, { enquiryId: string; reason?: string }>({
      query: ({ enquiryId, reason }) => ({
        url: `/mice/enquiries/${enquiryId}/cancel`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Mice"],
    }),
    getMiceEvent: build.query<MiceEvent, string>({
      query: (id) => `/mice/events/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    createMiceEvent: build.mutation<
      MiceEvent,
      {
        name: string;
        type: MiceEventType;
        venue?: string;
        startsAt: string;
        endsAt: string;
        budgetMinor?: number;
        currency?: string;
        autoCreateGroup?: boolean;
      }
    >({
      query: (body) => ({ url: "/mice/events", method: "POST", body }),
      invalidatesTags: ["Mice"],
    }),
    listMiceDelegates: build.query<Array<Record<string, unknown>>, string>({
      query: (id) => `/mice/events/${id}/delegates`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    registerMiceDelegate: build.mutation<
      unknown,
      { eventId: string; fullName: string; email: string; dietary?: string }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/delegates`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    selfRegisterMice: build.mutation<unknown, string>({
      query: (eventId) => ({ url: `/mice/events/${eventId}/register`, method: "POST", body: {} }),
      invalidatesTags: ["Mice"],
    }),
    listMiceSessions: build.query<Array<Record<string, unknown>>, string>({
      query: (id) => `/mice/events/${id}/sessions`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    createMiceSession: build.mutation<
      unknown,
      {
        eventId: string;
        title: string;
        startsAt: string;
        endsAt: string;
        track?: string;
        speakers?: string;
        location?: string;
      }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/sessions`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    miceCheckIn: build.mutation<unknown, { eventId: string; badgeCode: string; sessionId?: string }>({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/check-in`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    getMiceAttendance: build.query<Record<string, unknown>, string>({
      query: (id) => `/mice/events/${id}/attendance`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    getMiceBadge: build.query<
      { contentBase64: string; badgeCode: string; fullName: string; contentType: string },
      { eventId: string; delegateId: string }
    >({
      query: ({ eventId, delegateId }) => `/mice/events/${eventId}/delegates/${delegateId}/badge`,
    }),
    listMiceTravel: build.query<{ items: Array<Record<string, unknown>> }, string>({
      query: (id) => `/mice/events/${id}/travel`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    linkMiceBooking: build.mutation<
      unknown,
      { eventId: string; bookingId: string; kind?: string }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/travel`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    getMiceTransferCapability: build.query<
      {
        configured: boolean;
        canBookLive: boolean;
        provider: string;
        reasons: string[];
        liveStatus?: { configured?: boolean; canPollLive?: boolean; provider?: string };
      },
      void
    >({
      query: () => "/mice/transfers/capability",
      providesTags: ["Mice"],
    }),
    listMiceTransfers: build.query<
      { capability?: Record<string, unknown>; items: MiceTransfer[] },
      string
    >({
      query: (id) => `/mice/events/${id}/transfers`,
      transformResponse: (raw: unknown) => {
        if (Array.isArray(raw)) return { items: raw as MiceTransfer[] };
        const obj = (raw || {}) as { items?: MiceTransfer[]; capability?: Record<string, unknown> };
        return { capability: obj.capability, items: obj.items || [] };
      },
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    createMiceTransfer: build.mutation<
      MiceTransfer,
      {
        eventId: string;
        label: string;
        direction?: MiceTransferDirection;
        passengerCount?: number;
        airportCode?: string;
        flightRef?: string;
        flightBookingId?: string;
        delegateId?: string;
        pickupLocation?: string;
        dropoffLocation?: string;
        pickupAt?: string;
        notes?: string;
        idempotencyKey?: string;
        requestProviderBooking?: boolean;
      }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/transfers`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    updateMiceTransfer: build.mutation<
      MiceTransfer,
      { eventId: string; transferId: string } & Record<string, unknown>
    >({
      query: ({ eventId, transferId, ...body }) => ({
        url: `/mice/events/${eventId}/transfers/${transferId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    bookMiceTransfer: build.mutation<MiceTransfer, { eventId: string; transferId: string }>({
      query: ({ eventId, transferId }) => ({
        url: `/mice/events/${eventId}/transfers/${transferId}/book`,
        method: "POST",
      }),
      invalidatesTags: ["Mice"],
    }),
    getMiceBudget: build.query<Record<string, unknown>, string>({
      query: (id) => `/mice/events/${id}/budget`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    saveMiceBudgetLine: build.mutation<
      unknown,
      { eventId: string; category: string; label: string; plannedMinor?: number; actualMinor?: number }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/budget/lines`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    listMiceSponsors: build.query<Array<Record<string, unknown>>, string>({
      query: (id) => `/mice/events/${id}/sponsors`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
    createMiceSponsor: build.mutation<
      unknown,
      { eventId: string; name: string; tier?: string; deliverables?: string }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/mice/events/${eventId}/sponsors`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Mice"],
    }),
    getMiceReport: build.query<Record<string, unknown>, string>({
      query: (id) => `/mice/events/${id}/report`,
      providesTags: (_r, _e, id) => [{ type: "Mice", id }],
    }),
  }),
});

export const {
  useListMiceEventsQuery,
  useListMiceEnquiriesQuery,
  useGetMiceEnquiryQuery,
  useCreateMiceEnquiryMutation,
  useUpdateMiceEnquiryMutation,
  useCancelMiceEnquiryMutation,
  useGetMiceEventQuery,
  useCreateMiceEventMutation,
  useListMiceDelegatesQuery,
  useRegisterMiceDelegateMutation,
  useSelfRegisterMiceMutation,
  useListMiceSessionsQuery,
  useCreateMiceSessionMutation,
  useMiceCheckInMutation,
  useGetMiceAttendanceQuery,
  useLazyGetMiceBadgeQuery,
  useListMiceTravelQuery,
  useLinkMiceBookingMutation,
  useGetMiceTransferCapabilityQuery,
  useListMiceTransfersQuery,
  useCreateMiceTransferMutation,
  useBookMiceTransferMutation,
  useGetMiceBudgetQuery,
  useSaveMiceBudgetLineMutation,
  useListMiceSponsorsQuery,
  useCreateMiceSponsorMutation,
  useGetMiceReportQuery,
} = miceApi;

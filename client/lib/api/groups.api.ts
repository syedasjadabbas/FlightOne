/**
 * Module 11 — Group Travel API.
 */
import { baseApi } from "@/lib/api/baseApi";

export type GroupType =
  | "CORPORATE_TOUR"
  | "STUDENT"
  | "UMRAH_HAJJ"
  | "LEISURE"
  | "SPORTS"
  | "FAMILY"
  | "OTHER";

export type TravelGroup = {
  id: string;
  name: string;
  type: GroupType;
  createdByUserId: string;
  inviteCode: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  myRole?: string | null;
  myStatus?: string | null;
  myMembership?: { role: string; status: string } | null;
};

export type GroupTravelRequestStatus = "SUBMITTED" | "IN_REVIEW" | "CANCELLED";

export type GroupDateFlexibility = "EXACT" | "PLUS_MINUS_1" | "PLUS_MINUS_3" | "FLEXIBLE_WEEK";

export type GroupCabinPreference = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export type GroupTravelRequest = {
  id: string;
  createdByUserId: string;
  groupId: string | null;
  name: string;
  type: GroupType;
  status: GroupTravelRequestStatus;
  origin: string;
  destination: string;
  departureDate: string | null;
  returnDate: string | null;
  flexibility: GroupDateFlexibility;
  passengerCount: number;
  cabinPreference: GroupCabinPreference | null;
  purpose: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  organization: string | null;
  baggageRequired: boolean;
  seatingTogether: boolean;
  airportTransfers: boolean;
  splitBilling: boolean;
  accommodationRequired: boolean;
  accommodationNotes: string | null;
  transportNotes: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  fulfilment?: string;
  fulfilmentNote?: string;
  minPassengerCount?: number;
  group?: TravelGroup | null;
};

export type CreateGroupTravelRequestBody = {
  name: string;
  type: GroupType;
  origin: string;
  destination: string;
  departureDate?: string;
  returnDate?: string;
  flexibility: GroupDateFlexibility;
  passengerCount: number;
  cabinPreference?: GroupCabinPreference | null;
  purpose?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  organization?: string;
  baggageRequired?: boolean;
  seatingTogether?: boolean;
  airportTransfers?: boolean;
  splitBilling?: boolean;
  accommodationRequired?: boolean;
  accommodationNotes?: string;
  transportNotes?: string;
  notes?: string;
  idempotencyKey?: string;
};

export const groupsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMyGroups: build.query<TravelGroup[], void>({
      query: () => "/groups",
      providesTags: ["Groups"],
    }),
    listGroupTravelRequests: build.query<
      { items: GroupTravelRequest[]; minPassengerCount: number },
      void
    >({
      query: () => "/groups/requests",
      providesTags: ["Groups"],
    }),
    getGroupTravelRequest: build.query<GroupTravelRequest, string>({
      query: (requestId) => `/groups/requests/${requestId}`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id: `request-${id}` }],
    }),
    createGroupTravelRequest: build.mutation<GroupTravelRequest, CreateGroupTravelRequestBody>({
      query: (body) => ({ url: "/groups/requests", method: "POST", body }),
      invalidatesTags: ["Groups"],
    }),
    updateGroupTravelRequest: build.mutation<
      GroupTravelRequest,
      { requestId: string; body: Partial<CreateGroupTravelRequestBody> }
    >({
      query: ({ requestId, body }) => ({
        url: `/groups/requests/${requestId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    cancelGroupTravelRequest: build.mutation<GroupTravelRequest, { requestId: string; reason?: string }>({
      query: ({ requestId, reason }) => ({
        url: `/groups/requests/${requestId}/cancel`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["Groups"],
    }),
    getGroup: build.query<TravelGroup, string>({
      query: (id) => `/groups/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    createGroup: build.mutation<TravelGroup, { name: string; type: GroupType; metadata?: object }>({
      query: (body) => ({ url: "/groups", method: "POST", body }),
      invalidatesTags: ["Groups"],
    }),
    joinGroup: build.mutation<unknown, { inviteCode: string }>({
      query: (body) => ({ url: "/groups/join", method: "POST", body }),
      invalidatesTags: ["Groups"],
    }),
    listMembers: build.query<
      Array<{
        id: string;
        userId: string;
        role: string;
        status: string;
        displayName: string | null;
        email: string | null;
      }>,
      string
    >({
      query: (id) => `/groups/${id}/members`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    inviteMember: build.mutation<unknown, { groupId: string; email?: string; userId?: string }>({
      query: ({ groupId, ...body }) => ({
        url: `/groups/${groupId}/invitations`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    acceptInvite: build.mutation<unknown, string>({
      query: (id) => ({ url: `/groups/${id}/invitations/accept`, method: "POST" }),
      invalidatesTags: ["Groups"],
    }),
    declineInvite: build.mutation<unknown, string>({
      query: (id) => ({ url: `/groups/${id}/invitations/decline`, method: "POST" }),
      invalidatesTags: ["Groups"],
    }),
    leaveGroup: build.mutation<unknown, string>({
      query: (id) => ({ url: `/groups/${id}/leave`, method: "POST" }),
      invalidatesTags: ["Groups"],
    }),
    listAnnouncements: build.query<
      Array<{ id: string; body: string; isEmergency: boolean; priority: number; createdAt: string }>,
      string
    >({
      query: (id) => `/groups/${id}/announcements`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    createAnnouncement: build.mutation<unknown, { groupId: string; body: string }>({
      query: ({ groupId, body }) => ({
        url: `/groups/${groupId}/announcements`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: ["Groups"],
    }),
    createEmergency: build.mutation<unknown, { groupId: string; body: string }>({
      query: ({ groupId, body }) => ({
        url: `/groups/${groupId}/emergency`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: ["Groups"],
    }),
    listPolls: build.query<
      Array<{
        id: string;
        question: string;
        options: string[];
        voteCounts: Record<string, number>;
        myOptionIndex: number | null;
      }>,
      string
    >({
      query: (id) => `/groups/${id}/polls`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    createPoll: build.mutation<
      unknown,
      { groupId: string; question: string; options: string[] }
    >({
      query: ({ groupId, ...body }) => ({
        url: `/groups/${groupId}/polls`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    votePoll: build.mutation<unknown, { groupId: string; pollId: string; optionIndex: number }>({
      query: ({ groupId, pollId, optionIndex }) => ({
        url: `/groups/${groupId}/polls/${pollId}/vote`,
        method: "POST",
        body: { optionIndex },
      }),
      invalidatesTags: ["Groups"],
    }),
    getItinerary: build.query<
      { items: Array<{ shareId: string; booking: { id: string; status: string; itinerary: unknown } }> },
      string
    >({
      query: (id) => `/groups/${id}/itinerary`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    getFlightStatus: build.query<
      { capability: { canPollLive: boolean; reasons: string[] }; updates: Array<Record<string, unknown>> },
      string
    >({
      query: (id) => `/groups/${id}/flight-status`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    getLiveUpdates: build.query<{ items: Array<Record<string, unknown>> }, string>({
      query: (id) => `/groups/${id}/itinerary/updates`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    shareBooking: build.mutation<unknown, { groupId: string; bookingId: string }>({
      query: ({ groupId, bookingId }) => ({
        url: `/groups/${groupId}/itinerary/bookings`,
        method: "POST",
        body: { bookingId },
      }),
      invalidatesTags: ["Groups"],
    }),
    listGroupDocuments: build.query<{ items: Array<Record<string, unknown>> }, string>({
      query: (id) => `/groups/${id}/documents`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    shareDocument: build.mutation<unknown, { groupId: string; vaultDocumentId: string; label?: string }>({
      query: ({ groupId, ...body }) => ({
        url: `/groups/${groupId}/documents`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    listAttendance: build.query<
      { waypoints: Array<{ id: string; label: string }>; records: Array<Record<string, unknown>>; scope: string },
      string
    >({
      query: (id) => `/groups/${id}/attendance`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    createWaypoint: build.mutation<unknown, { groupId: string; label: string }>({
      query: ({ groupId, label }) => ({
        url: `/groups/${groupId}/attendance/waypoints`,
        method: "POST",
        body: { label },
      }),
      invalidatesTags: ["Groups"],
    }),
    markAttendance: build.mutation<
      unknown,
      { groupId: string; waypointId: string; status?: string }
    >({
      query: ({ groupId, waypointId, status }) => ({
        url: `/groups/${groupId}/attendance/waypoints/${waypointId}/mark`,
        method: "POST",
        body: { status: status || "PRESENT" },
      }),
      invalidatesTags: ["Groups"],
    }),
    listPhotos: build.query<{ items: Array<Record<string, unknown>>; storage: { canUpload: boolean } }, string>({
      query: (id) => `/groups/${id}/photos`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    uploadPhoto: build.mutation<
      unknown,
      { groupId: string; contentBase64: string; contentType: string; caption?: string }
    >({
      query: ({ groupId, ...body }) => ({
        url: `/groups/${groupId}/photos`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    listMemories: build.query<Array<{ id: string; title: string; body: string; status: string }>, string>({
      query: (id) => `/groups/${id}/memories`,
      providesTags: (_r, _e, id) => [{ type: "Groups", id }],
    }),
    generateMemory: build.mutation<{ id: string; title: string; body: string; status: string }, string>({
      query: (id) => ({ url: `/groups/${id}/memories/generate`, method: "POST" }),
      invalidatesTags: ["Groups"],
    }),
  }),
});

export const {
  useListMyGroupsQuery,
  useListGroupTravelRequestsQuery,
  useGetGroupTravelRequestQuery,
  useCreateGroupTravelRequestMutation,
  useUpdateGroupTravelRequestMutation,
  useCancelGroupTravelRequestMutation,
  useGetGroupQuery,
  useCreateGroupMutation,
  useJoinGroupMutation,
  useListMembersQuery,
  useInviteMemberMutation,
  useAcceptInviteMutation,
  useDeclineInviteMutation,
  useLeaveGroupMutation,
  useListAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useCreateEmergencyMutation,
  useListPollsQuery,
  useCreatePollMutation,
  useVotePollMutation,
  useGetItineraryQuery,
  useGetFlightStatusQuery,
  useGetLiveUpdatesQuery,
  useShareBookingMutation,
  useListGroupDocumentsQuery,
  useShareDocumentMutation,
  useListAttendanceQuery,
  useCreateWaypointMutation,
  useMarkAttendanceMutation,
  useListPhotosQuery,
  useUploadPhotoMutation,
  useListMemoriesQuery,
  useGenerateMemoryMutation,
} = groupsApi;

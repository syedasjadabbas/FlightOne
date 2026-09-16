/**
 * Module 13 — Human Agent Escalation API.
 */
import { baseApi } from "@/lib/api/baseApi";

export type EscalationStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CANCELLED";

export type EscalationTrigger =
  | "CUSTOMER_REQUEST"
  | "VIP_BOOKING"
  | "VIP"
  | "COMPLEX_ITINERARY"
  | "SUPPLIER_FAILURE"
  | "REFUND_DISPUTE"
  | "MEDICAL_ASSISTANCE"
  | "MEDICAL"
  | "SPECIAL_SERVICE_REQUEST"
  | "SSR"
  | "AI_DISCOUNT_LIMIT"
  | "VISA_UNCERTAIN"
  | "JOURNEY_DISRUPTION"
  | "OTHER";

export type ConsultantActionType =
  | "CANCEL_BOOKING"
  | "REFUND_PROCESS"
  | "REFUND_COMPLETE"
  | "REFUND_REJECT"
  | "JOURNEY_REBOOK_HANDOFF"
  | "LOG_RESOLUTION_OUTCOME";

export type ConsultantActionStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "DENIED"
  | "EXTERNAL_DEPENDENCY";

export type EscalationResolutionOutcome =
  | "RESOLVED_NO_CHANGE"
  | "BOOKING_CANCELLED"
  | "REFUND_PROCESSED"
  | "REFUND_REJECTED"
  | "REBOOK_HANDED_OFF"
  | "INFORMATION_PROVIDED"
  | "OTHER";

export type EscalationAction = {
  id: string;
  escalationId: string;
  actionType: ConsultantActionType | string;
  status: ConsultantActionStatus | string;
  actorUserId: string;
  bookingId: string | null;
  targetType: string | null;
  targetId: string | null;
  idempotencyKey: string | null;
  result?: unknown;
  error: string | null;
  createdAt: string;
  deduplicated?: boolean;
};

export type EscalationTicket = {
  id: string;
  conversationId: string;
  userId: string;
  status: EscalationStatus;
  trigger: EscalationTrigger;
  priority: number;
  assignedToUserId: string | null;
  bookingId: string | null;
  routingPool?: "VIP" | "MEDICAL" | "COMPLEX" | "GENERAL" | string | null;
  routingStatus?: "POOL_ROUTED" | "UNROUTED_NO_ELIGIBLE" | string | null;
  routing?: {
    pool: string | null;
    status: string | null;
    requiredPermissions?: string[];
    preferredLanguage?: string | null;
    eligibleConsultantCount?: number | null;
    reason?: string | null;
    routedAt?: string | null;
    availabilityClaimed?: boolean;
    autoAssigned?: boolean;
  } | null;
  handoffMode?: "COLD" | string | null;
  handoff?: {
    mode: string;
    warmStatus: string;
    note: string;
  } | null;
  lastWriteBackStatus?: string | null;
  lastWriteBackAt?: string | null;
  lastWriteBackAction?: string | null;
  resolutionOutcome?: EscalationResolutionOutcome | string | null;
  writeBackActions?: EscalationAction[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNote?: string | null;
  contextSnapshot?: {
    messages?: Array<{
      id: string;
      role: string;
      content: string;
      provider?: string | null;
      createdAt: string;
    }>;
    messageCount?: number;
    capturedAt?: string;
    reasonDetail?: string | null;
    routing?: EscalationTicket["routing"];
    [key: string]: unknown;
  };
  deduplicated?: boolean;
};

export type EscalationListPage = {
  items: EscalationTicket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const escalationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMyEscalations: build.query<EscalationListPage, { status?: EscalationStatus } | void>({
      query: (params) => ({
        url: "/escalations/mine",
        params: params || undefined,
      }),
      providesTags: ["Escalations"],
    }),
    getMyEscalation: build.query<EscalationTicket, string>({
      query: (id) => `/escalations/mine/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Escalations", id }],
    }),
    requestEscalation: build.mutation<
      EscalationTicket,
      {
        conversationId: string;
        trigger?: EscalationTrigger;
        bookingId?: string;
        note?: string;
      }
    >({
      query: (body) => ({ url: "/escalations/request", method: "POST", body }),
      invalidatesTags: ["Escalations", "Conversation"],
    }),
    listOpsEscalations: build.query<
      EscalationListPage,
      { status?: EscalationStatus; pool?: string; page?: number } | void
    >({
      query: (params) => ({
        url: "/escalations",
        params: params || undefined,
      }),
      providesTags: ["Escalations"],
    }),
    getOpsEscalation: build.query<EscalationTicket, string>({
      query: (id) => `/escalations/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Escalations", id }],
    }),
    claimEscalation: build.mutation<EscalationTicket, string>({
      query: (id) => ({ url: `/escalations/${id}/claim`, method: "POST" }),
      invalidatesTags: ["Escalations"],
    }),
    assignEscalation: build.mutation<
      EscalationTicket,
      { id: string; assignedToUserId?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/escalations/${id}/assign`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Escalations"],
    }),
    startEscalation: build.mutation<EscalationTicket, string>({
      query: (id) => ({ url: `/escalations/${id}/start`, method: "POST" }),
      invalidatesTags: ["Escalations"],
    }),
    resolveEscalation: build.mutation<
      EscalationTicket,
      { id: string; resolutionNote: string; outcome?: EscalationResolutionOutcome }
    >({
      query: ({ id, resolutionNote, outcome }) => ({
        url: `/escalations/${id}/resolve`,
        method: "POST",
        body: { resolutionNote, ...(outcome ? { outcome } : {}) },
      }),
      invalidatesTags: ["Escalations"],
    }),
    cancelEscalation: build.mutation<EscalationTicket, { id: string; note?: string }>({
      query: ({ id, note }) => ({
        url: `/escalations/${id}/cancel`,
        method: "POST",
        body: note ? { note } : {},
      }),
      invalidatesTags: ["Escalations"],
    }),
    applyConsultantAction: build.mutation<
      { action: EscalationAction; ticketId: string; providerFailure?: boolean },
      {
        id: string;
        actionType: ConsultantActionType;
        reason?: string;
        refundCaseId?: string;
        watchId?: string;
        supplierOfferSnapshotId?: string;
        idempotencyKey?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/escalations/${id}/actions`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Escalations"],
    }),
    getMyPermissions: build.query<{ global: string[]; byCompany: Record<string, string[]> }, void>({
      query: () => "/me/permissions",
      providesTags: ["Me"],
    }),
  }),
});

export const {
  useListMyEscalationsQuery,
  useGetMyEscalationQuery,
  useRequestEscalationMutation,
  useListOpsEscalationsQuery,
  useGetOpsEscalationQuery,
  useClaimEscalationMutation,
  useAssignEscalationMutation,
  useStartEscalationMutation,
  useResolveEscalationMutation,
  useCancelEscalationMutation,
  useApplyConsultantActionMutation,
  useGetMyPermissionsQuery,
} = escalationsApi;

/**
 * Module 14 — Refund & Reissue API client.
 */
import { baseApi } from "@/lib/api/baseApi";

export type RefundCaseStatus =
  | "DRAFT"
  | "QUOTED"
  | "ELIGIBLE"
  | "SUBMITTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REQUIRES_HUMAN"
  | "REJECTED"
  | "NOT_ELIGIBLE";

export type DataAvailabilityStatus =
  | "OK"
  | "DATA_UNAVAILABLE"
  | "UNSUPPORTED"
  | "PROVIDER_UNCONFIGURED"
  | "REQUIRES_HUMAN";

export type RefundCalculation = {
  id: string;
  bookingId: string;
  currency: string;
  grossPaidMinor: number;
  supplierPenaltyMinor: number;
  agencyFeeMinor: number;
  refundableMinor: number;
  nonRefundableMinor?: number;
  travelCreditMinor: number;
  dataStatus: DataAvailabilityStatus;
  processingTimelineStatus: DataAvailabilityStatus;
  processingTimelineNote?: string | null;
  product?: string | null;
  kind?: string;
  formula?: Record<string, unknown>;
  createdAt: string;
};

export type RefundCase = {
  id: string;
  bookingId: string;
  calculationId?: string | null;
  status: RefundCaseStatus;
  kind?: string;
  reason?: string | null;
  partial?: boolean;
  paymentRefundStatus?: string;
  paymentRefundRef?: string | null;
  supplierOperationStatus?: string | null;
  supplierOperationNote?: string | null;
  escalationId?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  calculation?: RefundCalculation | null;
  audit?: Array<{ id: string; action: string; createdAt: string; payload?: unknown }>;
  deduplicated?: boolean;
};

export type ServicingRequest = {
  id: string;
  bookingId: string;
  kind: string;
  status: string;
  dataStatus: DataAvailabilityStatus;
  currency?: string | null;
  fareDifferenceMinor?: number | null;
  changePenaltyMinor?: number | null;
  agencyFeeMinor?: number | null;
  customerDueMinor?: number | null;
  customerRefundMinor?: number | null;
  formula?: Record<string, unknown> | null;
  failureReason?: string | null;
  supplierResponse?: Record<string, unknown> | null;
  executed?: boolean;
  humanServicingRequired?: boolean;
  liveMutation?: boolean;
  ticketMutated?: boolean;
  bookingMutated?: boolean;
  bookingStatusUnchanged?: boolean;
  providerMutationStatus?: string;
  deduplicated?: boolean;
  message?: string;
  processingTimelineStatus?: DataAvailabilityStatus;
  processingTimelineNote?: string | null;
};

export const refundsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRefundEligibility: build.query<
      {
        eligible: boolean;
        status: string;
        reason?: string;
        bookingId: string;
        product?: string;
        currency?: string;
        calculationPreview?: Record<string, unknown>;
      },
      string
    >({
      query: (bookingId) => `/refunds/eligibility/${bookingId}`,
      providesTags: ["Refunds"],
    }),
    listRefundableBookings: build.query<
      {
        items: Array<{
          bookingId: string;
          status: string;
          product: string;
          currency: string;
          amountMinor: number;
          createdAt: string;
          eligible: boolean;
          eligibilityStatus: string;
          dataStatus: string;
          refundableMinor: number | null;
          confirmed: boolean;
        }>;
      },
      void
    >({
      query: () => "/refunds/bookings",
      providesTags: ["Refunds"],
    }),
    calculateRefund: build.mutation<
      RefundCalculation,
      {
        bookingId: string;
        partialRatio?: number;
        scheduleChangeAttributed?: boolean;
        kind?: string;
      }
    >({
      query: (body) => ({ url: "/refunds/calculate", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    createRefundCase: build.mutation<
      RefundCase,
      {
        bookingId: string;
        calculationId?: string;
        reason?: string;
        partial?: boolean;
        idempotencyKey?: string;
        kind?: string;
      }
    >({
      query: (body) => ({ url: "/refunds/cases", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    listRefundCases: build.query<
      { items: RefundCase[]; total: number },
      { bookingId?: string; status?: RefundCaseStatus } | void
    >({
      query: (params) => ({ url: "/refunds/cases", params: params || undefined }),
      providesTags: ["Refunds"],
    }),
    getRefundCase: build.query<RefundCase, string>({
      query: (id) => `/refunds/cases/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Refunds", id }],
    }),
    submitRefundCase: build.mutation<RefundCase, string>({
      query: (id) => ({ url: `/refunds/cases/${id}/submit`, method: "POST" }),
      invalidatesTags: ["Refunds"],
    }),
    processRefundCase: build.mutation<RefundCase, string>({
      query: (id) => ({ url: `/refunds/cases/${id}/process`, method: "POST" }),
      invalidatesTags: ["Refunds"],
    }),
    rejectRefundCase: build.mutation<RefundCase, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/refunds/cases/${id}/reject`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: ["Refunds"],
    }),
    requestCancellation: build.mutation<
      { calculation: RefundCalculation; refundCase: RefundCase; servicingRequest: ServicingRequest },
      { bookingId: string; reason?: string; idempotencyKey?: string }
    >({
      query: (body) => ({ url: "/refunds/cancellation/request", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    calculateExchange: build.mutation<
      ServicingRequest,
      { bookingId: string; newFareMinor?: number; kind?: "EXCHANGE" | "REISSUE" }
    >({
      query: (body) => ({ url: "/refunds/exchange/calculate", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    requestExchange: build.mutation<
      ServicingRequest,
      { bookingId: string; servicingRequestId: string; reason?: string; idempotencyKey?: string }
    >({
      query: (body) => ({ url: "/refunds/exchange/request", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    scheduleChangeServicing: build.mutation<
      { calculation: RefundCalculation; refundCase: RefundCase; servicingRequest: ServicingRequest },
      { bookingId: string; journeyEventId?: string }
    >({
      query: (body) => ({ url: "/refunds/schedule-change", method: "POST", body }),
      invalidatesTags: ["Refunds"],
    }),
    listTravelCredits: build.query<{ items: Array<Record<string, unknown>> }, void>({
      query: () => "/refunds/credits",
      providesTags: ["Refunds"],
    }),
    listServicingRequests: build.query<{ items: ServicingRequest[]; total: number }, void>({
      query: () => "/refunds/servicing",
      providesTags: ["Refunds"],
    }),
  }),
});

export const {
  useGetRefundEligibilityQuery,
  useListRefundableBookingsQuery,
  useCalculateRefundMutation,
  useCreateRefundCaseMutation,
  useListRefundCasesQuery,
  useGetRefundCaseQuery,
  useSubmitRefundCaseMutation,
  useProcessRefundCaseMutation,
  useRejectRefundCaseMutation,
  useRequestCancellationMutation,
  useCalculateExchangeMutation,
  useRequestExchangeMutation,
  useScheduleChangeServicingMutation,
  useListTravelCreditsQuery,
  useListServicingRequestsQuery,
} = refundsApi;

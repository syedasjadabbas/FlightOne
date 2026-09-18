/**
 * Module 03 — authenticated booking checkout API helpers.
 */
import { baseApi } from "@/lib/api/baseApi";

export type BookingStatus =
  | "QUOTED"
  | "RESERVED"
  | "TICKETED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type BookingDetail = {
  id: string;
  status: BookingStatus;
  product: "FLIGHT" | "HOTEL" | "PACKAGE";
  currency: string;
  amountMinor: number;
  netMinor: number;
  marginMinor: number;
  supplierCode: string | null;
  externalRef: string | null;
  quoteExpiresAt: string | null;
  reservedUntil: string | null;
  travellerSnapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  payments?: PaymentRow[];
  paymentCapability?: {
    configured: boolean;
    canCapture: boolean;
    mode: string;
    provider: string;
    reasons: string[];
  };
  supplierCapability?: {
    canReserve: boolean;
    canTicket: boolean;
    mode: string;
    reasons: string[];
  };
  transitions?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export type PaymentRow = {
  id: string;
  status: string;
  provider: string;
  amountMinor: number;
  currency: string;
  providerPaymentId: string | null;
  metadata?: Record<string, any> | null;
};

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBooking: build.query<BookingDetail, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Fare" as const, id }],
    }),
    payBooking: build.mutation<
      PaymentRow,
      {
        id: string;
        paymentMethodToken?: string;
        accountNumber?: string;
        method?: "card" | "corporate_credit" | "jazzcash" | "easypaisa" | "onelink_ibft";
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/bookings/${id}/pay`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Fare" as const, id: arg.id }],
    }),
    reserveBooking: build.mutation<
      BookingDetail,
      {
        id: string;
        clientAmountMinor?: number;
        travellerSnapshot?: { givenName: string; surname: string };
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/bookings/${id}/reserve`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Fare" as const, id: arg.id }],
    }),
    ticketBooking: build.mutation<
      BookingDetail,
      { id: string; clientAmountMinor?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/bookings/${id}/ticket`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Fare" as const, id: arg.id }],
    }),
    acceptPriceChange: build.mutation<
      BookingDetail,
      { id: string; acceptedAmountMinor: number }
    >({
      query: ({ id, acceptedAmountMinor }) => ({
        url: `/bookings/${id}/accept-price`,
        method: "POST",
        body: { acceptedAmountMinor },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Fare" as const, id: arg.id }],
    }),
  }),
});

export const {
  useGetBookingQuery,
  usePayBookingMutation,
  useReserveBookingMutation,
  useTicketBookingMutation,
  useAcceptPriceChangeMutation,
} = bookingsApi;

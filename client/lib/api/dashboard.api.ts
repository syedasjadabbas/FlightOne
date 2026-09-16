/**
 * Module 17 — Management Dashboard API client.
 */
import { baseApi } from "@/lib/api/baseApi";

export type DashboardOverview = {
  range: { from: string; to: string };
  sales: {
    dataStatus: string;
    volumeCreated: number;
    recognizedSales: number;
    definition?: string;
    byStatus?: Array<{ status: string; count: number }>;
    byProduct?: Array<{ product: string; count: number }>;
  };
  revenue: {
    dataStatus?: string;
    currency?: string | null;
    mixed?: boolean;
    revenueMinor?: number;
    marginMinor?: number;
    netMinor?: number;
    bookingCount?: number;
    byCurrency?: Array<{
      currency: string;
      revenueMinor: number;
      marginMinor: number;
      bookingCount: number;
    }>;
    note?: string;
  };
  margins: {
    dataStatus?: string;
    currency?: string | null;
    mixed?: boolean;
    revenueMinor?: number;
    marginMinor?: number;
    netMinor?: number;
    bookingCount?: number;
    marginRate?: number | null;
    byCurrency?: Array<{
      currency: string;
      revenueMinor: number;
      marginMinor: number;
      bookingCount: number;
      marginRate?: number | null;
    }>;
    note?: string;
  };
  outstandingCredit: {
    available: boolean;
    dataStatus?: string;
    companies: Array<{
      id: string;
      name: string;
      currency: string;
      creditLimitMinor: number;
      creditUsedMinor: number;
      remainingMinor: number;
    }>;
  };
  bookingConversion: {
    dataStatus?: string;
    funnel: {
      searches: number;
      quoted: number;
      reachedReserved: number;
      reachedTicketed: number;
    };
    conversion: {
      searchToQuote: number | null;
      quotedToReserved: number | null;
      reservedToTicketed: number | null;
      quotedToTicketed: number | null;
    };
    searchInstrumentation?: string;
    note?: string;
  };
  aiAutomation: {
    dataStatus?: string;
    conversationsTotal: number;
    escalatedConversations: number;
    automationRate: number | null;
    formula?: string;
  };
  supplierPerformance: {
    dataStatus?: string;
    suppliers: Array<{
      supplierCode: string;
      bookings: number;
      ticketedOrActive: number;
      cancelledOrRefunded: number;
      fulfillmentRate: number | null;
      cancelRefundRate: number | null;
    }>;
  };
  customerAnalytics: {
    dataStatus?: string;
    usersTotal: number;
    profilesTotal: number;
    bookersInRange: number;
    repeatBookersInRange: number;
    averageOrderValueByCurrency: Array<{
      currency: string;
      avgAmountMinor: number;
      bookingCount: number;
    }>;
    loyaltyTiers: Array<{ tier: string; count: number }>;
  };
  operationalKpis: {
    openEscalations: number;
    escalationsCreatedInRange: number;
    pendingRefunds: number;
    reconciliationNeedsAttention: number;
    reconciliationMismatches: number;
    opsOutboxPending: number;
    opsOutboxFailed: number;
    activeJourneyWatches: number;
    journeyEventsInRange: number;
  };
  freshness: { strategy: string; cacheTtlMs: number; computedAt: string };
};

function rangeParams(from: string, to: string, extra?: { currency?: string; product?: string }) {
  return { from, to, ...extra };
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOverview: build.query<
      DashboardOverview,
      { from: string; to: string; currency?: string; product?: string }
    >({
      query: (params) => ({ url: "/dashboard/overview", params: rangeParams(params.from, params.to, params) }),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardOverviewQuery } = dashboardApi;

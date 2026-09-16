/**
 * Module 15 — Operations Platform API client.
 */
import { baseApi } from "@/lib/api/baseApi";

export type OpsIntegrationCapability = {
  name: string;
  state: "CONFIGURED" | "UNCONFIGURED" | "VERIFIED" | "DATA_UNAVAILABLE" | "ERROR";
  configured: boolean;
  verified: boolean;
  canPush: boolean;
  reasons: string[];
};

export type OpsOverview = {
  outbox: {
    pending: number;
    failed: number;
    delivered: number;
    processing?: number;
    retrying?: number;
    unconfigured?: number;
  };
  accountingEntries: number;
  commissions: number;
  reconciliation: { needsAttention: number; mismatches: number };
  integrations: Record<string, OpsIntegrationCapability>;
};

export type OpsOutboxEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  status:
    | "PENDING"
    | "PROCESSING"
    | "DELIVERED"
    | "FAILED"
    | "SKIPPED_UNCONFIGURED";
  displayStatus?:
    | "PENDING"
    | "PROCESSING"
    | "DELIVERED"
    | "FAILED"
    | "SKIPPED_UNCONFIGURED"
    | "RETRYING";
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
};

export type AccountingEntry = {
  id: string;
  bookingId?: string | null;
  entryType: "REVENUE" | "COST" | "COMMISSION" | "REFUND" | "PAYMENT" | "MARGIN" | "CREDIT";
  currency: string;
  amountMinor: number;
  memo?: string | null;
  companyId?: string | null;
  paymentId?: string | null;
  createdAt: string;
};

export type AccountingAggregate = {
  currency: string;
  entryType: string;
  amountMinorSum: number;
  count: number;
};

export type CommissionRecord = {
  id: string;
  bookingId: string;
  currency: string;
  basisMinor: number;
  commissionBps: number;
  commissionMinor: number;
  status: string;
  source: string;
  companyId?: string | null;
  userId?: string | null;
  supplierCode?: string | null;
  createdAt: string;
};

export type SupplierReconItem = {
  id: string;
  supplierCode: string;
  externalRef?: string | null;
  bookingId?: string | null;
  expectedMinor: number;
  invoicedMinor?: number | null;
  currency?: string | null;
  status: string;
  notes?: string | null;
  mismatchReason?: string | null;
  createdAt: string;
};

export type AuditLogItem = {
  id: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: unknown;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const operationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOpsOverview: build.query<OpsOverview, void>({
      query: () => "/operations/overview",
      providesTags: ["Operations"],
    }),
    getOpsIntegrations: build.query<Record<string, OpsIntegrationCapability>, void>({
      query: () => "/operations/integrations",
      providesTags: ["Operations"],
    }),
    listOpsOutbox: build.query<
      Paginated<OpsOutboxEvent>,
      { status?: string; page?: number; pageSize?: number } | void
    >({
      query: (params) => ({ url: "/operations/outbox", params: params || undefined }),
      providesTags: ["Operations"],
    }),
    drainOpsOutbox: build.mutation<
      {
        delivered: number;
        failed: number;
        deferred?: number;
        unconfigured?: number;
        claimed?: number;
      },
      { limit?: number } | void
    >({
      query: (body) => ({
        url: "/operations/outbox/drain",
        method: "POST",
        body: body || {},
      }),
      invalidatesTags: ["Operations"],
    }),
    retryOpsOutbox: build.mutation<
      { delivered: number; failed: number },
      { limit?: number; eventId?: string } | void
    >({
      query: (body) => ({
        url: "/operations/outbox/retry",
        method: "POST",
        body: body || {},
      }),
      invalidatesTags: ["Operations"],
    }),
    listOpsAccounting: build.query<
      Paginated<AccountingEntry> & { aggregates?: AccountingAggregate[] },
      { bookingId?: string; entryType?: string; companyId?: string; page?: number } | void
    >({
      query: (params) => ({ url: "/operations/accounting", params: params || undefined }),
      providesTags: ["Operations"],
    }),
    getOpsFinance: build.query<
      {
        capability: OpsIntegrationCapability;
        externalAccounting?: {
          state: string;
          configured: boolean;
          syncStatus: string;
          dataAvailability: string;
          reasons: string[];
        };
        payments: Paginated<{
          id: string;
          bookingId: string;
          status: string;
          amountMinor: number;
          currency: string;
        }>;
        accountingEntries: AccountingEntry[];
        refundCases: Array<{ id: string; status: string; paymentRefundStatus?: string }>;
        aggregates?: {
          payments: Array<{
            currency: string;
            status: string;
            amountMinorSum: number;
            count: number;
          }>;
          accounting: AccountingAggregate[];
        };
      },
      { bookingId?: string; companyId?: string } | void
    >({
      query: (params) => ({ url: "/operations/finance", params: params || undefined }),
      providesTags: ["Operations"],
    }),
    listOpsCommissions: build.query<
      Paginated<CommissionRecord> & {
        capability: OpsIntegrationCapability;
        aggregates?: Array<{
          currency: string;
          commissionMinorSum: number;
          basisMinorSum: number;
          count: number;
        }>;
      },
      { bookingId?: string; companyId?: string } | void
    >({
      query: (params) => ({ url: "/operations/commissions", params: params || undefined }),
      providesTags: ["Operations"],
    }),
    listOpsReconciliation: build.query<
      Paginated<SupplierReconItem>,
      { status?: string; page?: number } | void
    >({
      query: (params) => ({ url: "/operations/reconcile", params: params || undefined }),
      providesTags: ["Operations"],
    }),
    createOpsReconciliation: build.mutation<
      SupplierReconItem,
      {
        bookingId?: string;
        invoicedMinor?: number | null;
        supplierCode?: string;
        expectedMinor?: number;
        externalRef?: string;
        notes?: string;
        idempotencyKey?: string;
      }
    >({
      query: (body) => ({ url: "/operations/reconcile", method: "POST", body }),
      invalidatesTags: ["Operations"],
    }),
    listOpsAudit: build.query<
      Paginated<AuditLogItem>,
      { resourceType?: string; resourceId?: string; page?: number } | void
    >({
      query: (params) => ({ url: "/operations/audit", params: params || undefined }),
      providesTags: ["Operations"],
    }),
  }),
});

export const {
  useGetOpsOverviewQuery,
  useGetOpsIntegrationsQuery,
  useListOpsOutboxQuery,
  useDrainOpsOutboxMutation,
  useRetryOpsOutboxMutation,
  useListOpsAccountingQuery,
  useGetOpsFinanceQuery,
  useListOpsCommissionsQuery,
  useListOpsReconciliationQuery,
  useCreateOpsReconciliationMutation,
  useListOpsAuditQuery,
} = operationsApi;

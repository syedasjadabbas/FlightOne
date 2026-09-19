/**
 * Module 06 — Corporate Travel API (authenticated).
 */
import { baseApi } from "@/lib/api/baseApi";

export type CompanyMembershipRole = "MEMBER" | "APPROVER" | "ADMIN";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type Company = {
  id: string;
  name: string;
  creditLimitMinor: number;
  creditUsedMinor: number;
  currency: string;
  isActive: boolean;
  billingCycle: string | null;
  markupBps: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveCorporateProfile = {
  mode: "PERSONAL" | "CORPORATE";
  companyId: string | null;
  membership?: {
    role: CompanyMembershipRole;
    department: string | null;
    costCentre: string | null;
  };
  company?: {
    id: string;
    name: string;
    currency: string;
    creditLimitMinor: number;
    creditUsedMinor: number;
    creditAvailableMinor: number;
    markupBps: number | null;
  };
  policy?: {
    id: string;
    maxCabin: string | null;
    maxAmountMinor: number | null;
    preferredAirlines: unknown;
    advanceBookingDays: number | null;
  } | null;
  avaConstraints?: {
    maxCabin: string | null;
    maxAmountMinor: number | null;
    preferredAirlines: string[];
    advanceBookingDays: number | null;
    authoritative: boolean;
    note: string;
  } | null;
  travellerProfile?: {
    displayName: string | null;
    preferredCabin: string | null;
    preferredAirlines: unknown;
    seatPref: string | null;
    mealPref: string | null;
  } | null;
};

export type ApprovalRequest = {
  id: string;
  companyId: string;
  bookingId: string;
  status: ApprovalStatus;
  amountMinor: number;
  currency: string;
  policyViolation: Record<string, unknown> | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type PolicyEvaluation = {
  withinPolicy: boolean;
  violations: Array<{ code: string; message: string; [k: string]: unknown }>;
  policy: Record<string, unknown> | null;
};

export type ProjectCode = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CorporateInvoiceStatus = "ISSUED" | "PAID" | "VOID";

export type CorporateInvoice = {
  id: string;
  companyId: string;
  invoiceNumber: string;
  bookingId: string;
  status: CorporateInvoiceStatus;
  currency: string;
  netMinor: number;
  amountMinor: number;
  marginMinor: number;
  billingCycle: string | null;
  companyName: string;
  projectCode: string | null;
  projectCodeName: string | null;
  product: string | null;
  externalRef: string | null;
  travellerName: string | null;
  issuedAt: string;
  paidAt: string | null;
  voidedAt: string | null;
};

export type AdvancedAnalyticsDto = {
  range: { from: string; to: string };
  companyId: string | null;
  forecasts: {
    volume: {
      available: boolean;
      status: string;
      explanation?: string;
      forecast?: number | null;
      sampleCount?: number;
      provenance?: { generatedAt?: string; sampleCount?: number; methodCode?: string };
    };
    spend: { available: boolean; status: string; explanation?: string; forecast?: number | null; sampleCount?: number };
  };
  cohorts: {
    dataStatus: string;
    items: Array<{
      cohort: string;
      size: number;
      activeTravellers: number;
      bookings: number;
      spendMinor: number;
    }>;
    emptyReason: string | null;
    privacy?: string;
  };
  elasticity: {
    available: boolean;
    status: string;
    kind?: string;
    causal?: boolean;
    autoPriceChange?: boolean;
    explanation?: string;
    sampleCount?: number;
  };
  suppliers: {
    available: boolean;
    status: string;
    insights: Array<{ kind: string; body: string; supplierCode?: string }>;
    explanation?: string;
    autoNegotiate?: boolean;
  };
  phase3Activity?: {
    voiceSessions: number;
    conciergeExecutions: number;
    predictiveSignals: number;
    expenses: number | null;
    carbonEstimatesAvailable: number | null;
    note?: string;
  };
  pricesUnchanged?: boolean;
  contractsUnchanged?: boolean;
};

export const corporateApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCompanies: build.query<Company[], void>({
      query: () => "/corporate/companies",
      providesTags: ["Corporate"],
    }),
    getActiveCorporateProfile: build.query<
      ActiveCorporateProfile,
      { mode?: "PERSONAL" | "CORPORATE"; companyId?: string }
    >({
      query: ({ mode = "PERSONAL", companyId } = {}) => {
        const params = new URLSearchParams();
        params.set("mode", mode);
        if (companyId) params.set("companyId", companyId);
        return `/corporate/me/active-profile?${params.toString()}`;
      },
      providesTags: ["Corporate"],
    }),
    listApprovals: build.query<
      { items: ApprovalRequest[]; total: number },
      { companyId?: string; status?: ApprovalStatus }
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.companyId) params.set("companyId", args.companyId);
        if (args.status) params.set("status", args.status);
        const q = params.toString();
        return `/corporate/approvals${q ? `?${q}` : ""}`;
      },
      providesTags: ["Corporate"],
    }),
    createApproval: build.mutation<ApprovalRequest, { bookingId: string; companyId: string }>({
      query: (body) => ({ url: "/corporate/approvals", method: "POST", body }),
      invalidatesTags: ["Corporate", "Fare"],
    }),
    decideApproval: build.mutation<
      ApprovalRequest,
      { id: string; decision: "APPROVE" | "REJECT" | "CHANGES_REQUESTED"; note?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/corporate/approvals/${id}/decide`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate", "Fare"],
    }),
    evaluateCompanyPolicy: build.mutation<
      PolicyEvaluation,
      {
        companyId: string;
        amountMinor?: number;
        cabin?: string;
        airline?: string;
        departureDate?: string;
      }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/evaluate-policy`,
        method: "POST",
        body,
      }),
    }),
    updateCompany: build.mutation<
      Company,
      {
        id: string;
        name?: string;
        creditLimitMinor?: number;
        billingCycle?: string | null;
        isActive?: boolean;
        markupBps?: number | null;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/corporate/companies/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    getBookingApprovalGate: build.query<
      {
        corporate: boolean;
        companyId: string | null;
        approvalStatus: "REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | string | null;
        canProceed: boolean;
        policyEvaluation: {
          withinPolicy: boolean;
          violations: Array<{ code: string; message: string }>;
          policyId: string | null;
        } | null;
      },
      string
    >({
      query: (bookingId) => `/corporate/bookings/${bookingId}/approval-gate`,
      providesTags: (_r, _e, id) => [{ type: "Corporate" as const, id }, "Fare"],
    }),
    listCompanyBookings: build.query<
      {
        items: Array<{
          id: string;
          status: string;
          amountMinor: number;
          currency?: string;
          product?: string;
          createdAt?: string;
          metadata?: {
            projectCode?: string;
            projectCodeName?: string;
            projectCodeId?: string;
            companyId?: string;
          } | null;
        }>;
        total: number;
      },
      { companyId: string }
    >({
      query: ({ companyId }) => `/corporate/companies/${companyId}/bookings`,
      providesTags: ["Corporate"],
    }),
    listCompanyMembers: build.query<
      Array<{
        userId: string;
        role: CompanyMembershipRole;
        department: string | null;
        costCentre: string | null;
        traveller?: { email?: string; name?: string | null; displayName?: string | null };
      }>,
      string
    >({
      query: (companyId) => `/corporate/companies/${companyId}/members`,
      providesTags: ["Corporate"],
    }),
    listCompanyPolicies: build.query<
      Array<{
        id: string;
        maxCabin: string | null;
        maxAmountMinor: number | null;
        preferredAirlines: unknown;
        advanceBookingDays: number | null;
        isActive?: boolean;
      }>,
      string
    >({
      query: (companyId) => `/corporate/companies/${companyId}/policies`,
      providesTags: ["Corporate"],
    }),
    createCompany: build.mutation<
      Company,
      { name: string; currency?: string; creditLimitMinor?: number }
    >({
      query: (body) => ({ url: "/corporate/companies", method: "POST", body }),
      invalidatesTags: ["Corporate"],
    }),
    listCompanyAudit: build.query<
      {
        items: Array<{
          id: string;
          action: string;
          resourceType?: string;
          resourceId?: string | null;
          createdAt: string;
          metadata?: unknown;
        }>;
        total?: number;
      },
      { companyId: string; page?: number; pageSize?: number }
    >({
      query: ({ companyId, page, pageSize }) => ({
        url: `/corporate/companies/${companyId}/audit`,
        params: { page, pageSize },
      }),
      providesTags: ["Corporate"],
    }),
    listProjectCodes: build.query<
      ProjectCode[],
      { companyId: string; activeOnly?: boolean }
    >({
      query: ({ companyId, activeOnly }) => {
        const params = new URLSearchParams();
        if (activeOnly) params.set("activeOnly", "true");
        const q = params.toString();
        return `/corporate/companies/${companyId}/project-codes${q ? `?${q}` : ""}`;
      },
      providesTags: ["Corporate"],
    }),
    createProjectCode: build.mutation<
      ProjectCode,
      { companyId: string; code: string; name: string; isActive?: boolean }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/project-codes`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    updateProjectCode: build.mutation<
      ProjectCode,
      {
        companyId: string;
        projectCodeId: string;
        code?: string;
        name?: string;
        isActive?: boolean;
      }
    >({
      query: ({ companyId, projectCodeId, ...body }) => ({
        url: `/corporate/companies/${companyId}/project-codes/${projectCodeId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Corporate", "Fare"],
    }),
    setBookingProjectCode: build.mutation<
      { id: string; status: string; metadata: Record<string, unknown> | null },
      { bookingId: string; projectCodeId: string }
    >({
      query: ({ bookingId, projectCodeId }) => ({
        url: `/corporate/bookings/${bookingId}/project-code`,
        method: "PATCH",
        body: { projectCodeId },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Fare" as const, id: arg.bookingId },
        "Corporate",
      ],
    }),
    listInvoices: build.query<
      { items: CorporateInvoice[]; total: number },
      { companyId: string; page?: number; pageSize?: number }
    >({
      query: ({ companyId, page, pageSize }) => ({
        url: `/corporate/companies/${companyId}/invoices`,
        params: { page, pageSize },
      }),
      providesTags: ["Corporate"],
    }),
    issueInvoice: build.mutation<CorporateInvoice, { companyId: string; bookingId: string }>({
      query: ({ companyId, bookingId }) => ({
        url: `/corporate/companies/${companyId}/invoices`,
        method: "POST",
        body: { bookingId },
      }),
      invalidatesTags: ["Corporate"],
    }),
    getInvoicePdf: build.query<
      {
        invoiceId: string;
        invoiceNumber: string;
        contentType: string;
        filename: string;
        contentBase64: string;
      },
      { companyId: string; invoiceId: string }
    >({
      query: ({ companyId, invoiceId }) =>
        `/corporate/companies/${companyId}/invoices/${invoiceId}/pdf`,
    }),
    updateInvoiceStatus: build.mutation<
      CorporateInvoice,
      { companyId: string; invoiceId: string; status: CorporateInvoiceStatus }
    >({
      query: ({ companyId, invoiceId, status }) => ({
        url: `/corporate/companies/${companyId}/invoices/${invoiceId}`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Corporate"],
    }),
    getCompanyPortal: build.query<
      {
        branding: {
          portalName: string;
          displayName: string | null;
          logoUrl: string | null;
          primaryColor: string | null;
          secondaryColor: string | null;
          enabled: boolean;
        };
        domain: {
          hostname: string | null;
          status: string;
          reason: string | null;
          verificationToken: string | null;
          capability: { configured: boolean; reason: string | null };
        };
        sso: {
          providerType: string | null;
          issuer: string | null;
          clientId: string | null;
          enabled: boolean;
          status: string;
          reason: string | null;
          hasClientSecret: boolean;
          capability: { configured: boolean; available: boolean; reason: string | null };
        };
      },
      string
    >({
      query: (companyId) => `/corporate/companies/${companyId}/portal`,
      providesTags: ["Corporate"],
    }),
    updateCompanyBranding: build.mutation<
      unknown,
      {
        companyId: string;
        portalName?: string;
        displayName?: string | null;
        logoUrl?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
        portalEnabled?: boolean;
      }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/portal/branding`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    configureCompanyDomain: build.mutation<unknown, { companyId: string; hostname: string }>({
      query: ({ companyId, hostname }) => ({
        url: `/corporate/companies/${companyId}/portal/domain`,
        method: "POST",
        body: { hostname },
      }),
      invalidatesTags: ["Corporate"],
    }),
    verifyCompanyDomain: build.mutation<unknown, { companyId: string }>({
      query: ({ companyId }) => ({
        url: `/corporate/companies/${companyId}/portal/domain/verify`,
        method: "POST",
      }),
      invalidatesTags: ["Corporate"],
    }),
    updateCompanySso: build.mutation<
      unknown,
      {
        companyId: string;
        providerType?: "oidc" | "saml" | "unconfigured";
        issuer?: string | null;
        clientId?: string | null;
        clientSecret?: string;
        metadataUrl?: string | null;
        enabled?: boolean;
      }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/portal/sso`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    listExpenses: build.query<
      {
        items: Array<{
          id: string;
          category: string;
          amountMinor: number;
          currency: string;
          merchant: string | null;
          status: string;
          ocrStatus: string;
          hasReceipt: boolean;
          bookingId: string | null;
          expenseDate: string;
          perDiemConfigured: boolean;
        }>;
        total: number;
        ocr: { configured: boolean; reason: string | null };
        financeExport: { configured: boolean; reason: string | null };
      },
      { companyId: string; status?: string }
    >({
      query: ({ companyId, status }) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        const q = params.toString();
        return `/corporate/companies/${companyId}/expenses${q ? `?${q}` : ""}`;
      },
      providesTags: ["Corporate"],
    }),
    createExpense: build.mutation<
      { id: string },
      {
        companyId: string;
        amountMinor: number;
        currency?: string;
        category?: string;
        merchant?: string;
        description?: string;
        expenseDate?: string;
        bookingId?: string;
        days?: number;
      }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/expenses`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    submitExpense: build.mutation<unknown, { companyId: string; expenseId: string }>({
      query: ({ companyId, expenseId }) => ({
        url: `/corporate/companies/${companyId}/expenses/${expenseId}/submit`,
        method: "POST",
      }),
      invalidatesTags: ["Corporate"],
    }),
    decideExpense: build.mutation<
      unknown,
      { companyId: string; expenseId: string; decision: "APPROVE" | "REJECT"; note?: string }
    >({
      query: ({ companyId, expenseId, ...body }) => ({
        url: `/corporate/companies/${companyId}/expenses/${expenseId}/decide`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    reimburseExpense: build.mutation<unknown, { companyId: string; expenseId: string }>({
      query: ({ companyId, expenseId }) => ({
        url: `/corporate/companies/${companyId}/expenses/${expenseId}/reimburse`,
        method: "POST",
      }),
      invalidatesTags: ["Corporate"],
    }),
    exportExpenses: build.query<
      {
        format: string;
        filename: string;
        contentBase64: string;
        count: number;
        submittedExternally: boolean;
        integration: { configured: boolean; reason: string | null };
      },
      { companyId: string }
    >({
      query: ({ companyId }) => `/corporate/companies/${companyId}/expenses/export`,
    }),
    attachExpenseReceipt: build.mutation<
      unknown,
      { companyId: string; expenseId: string; contentBase64: string; contentType: string; originalFilename?: string }
    >({
      query: ({ companyId, expenseId, ...body }) => ({
        url: `/corporate/companies/${companyId}/expenses/${expenseId}/receipt`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    listPerDiemPolicies: build.query<
      { configured: boolean; items: Array<{ id: string; name: string; dailyAmountMinor: number; currency: string }>; emptyReason: string | null },
      string
    >({
      query: (companyId) => `/corporate/companies/${companyId}/per-diem`,
      providesTags: ["Corporate"],
    }),
    upsertPerDiemPolicy: build.mutation<
      unknown,
      { companyId: string; name?: string; dailyAmountMinor: number; currency?: string }
    >({
      query: ({ companyId, ...body }) => ({
        url: `/corporate/companies/${companyId}/per-diem`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Corporate"],
    }),
    getCarbonDashboard: build.query<
      {
        totals: {
          gramsCo2e: number;
          flightGramsCo2e: number;
          hotelGramsCo2e: number;
          bookingCount: number;
          estimatedCount: number;
          insufficientCount: number;
        };
        method: { code: string; version: string; note: string };
        breakdown: Array<{
          bookingId: string;
          product: string;
          status: string;
          gramsCo2e: number | null;
          reason: string | null;
        }>;
        period: { from: string | null; to: string | null };
      },
      { companyId: string; from?: string; to?: string }
    >({
      query: ({ companyId, from, to }) => {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const q = params.toString();
        return `/corporate/companies/${companyId}/carbon${q ? `?${q}` : ""}`;
      },
      providesTags: ["Corporate"],
    }),
    getCarbonNudges: build.query<
      { items: Array<{ kind: string; title: string; body: string }>; emptyReason: string | null },
      string
    >({
      query: (companyId) => `/corporate/companies/${companyId}/carbon/nudges`,
      providesTags: ["Corporate"],
    }),
    getCompanyAnalytics: build.query<
      AdvancedAnalyticsDto,
      { companyId: string; from: string; to: string }
    >({
      query: ({ companyId, from, to }) => ({
        url: `/corporate/companies/${companyId}/analytics`,
        params: { from, to },
      }),
      providesTags: ["Corporate"],
    }),
  }),
});

export const {
  useListCompaniesQuery,
  useGetActiveCorporateProfileQuery,
  useLazyGetActiveCorporateProfileQuery,
  useListApprovalsQuery,
  useCreateApprovalMutation,
  useDecideApprovalMutation,
  useEvaluateCompanyPolicyMutation,
  useUpdateCompanyMutation,
  useGetBookingApprovalGateQuery,
  useListCompanyBookingsQuery,
  useListCompanyMembersQuery,
  useListCompanyPoliciesQuery,
  useCreateCompanyMutation,
  useListCompanyAuditQuery,
  useListProjectCodesQuery,
  useCreateProjectCodeMutation,
  useUpdateProjectCodeMutation,
  useSetBookingProjectCodeMutation,
  useListInvoicesQuery,
  useIssueInvoiceMutation,
  useLazyGetInvoicePdfQuery,
  useUpdateInvoiceStatusMutation,
  useGetCompanyPortalQuery,
  useUpdateCompanyBrandingMutation,
  useConfigureCompanyDomainMutation,
  useVerifyCompanyDomainMutation,
  useUpdateCompanySsoMutation,
  useListExpensesQuery,
  useCreateExpenseMutation,
  useSubmitExpenseMutation,
  useDecideExpenseMutation,
  useReimburseExpenseMutation,
  useLazyExportExpensesQuery,
  useAttachExpenseReceiptMutation,
  useListPerDiemPoliciesQuery,
  useUpsertPerDiemPolicyMutation,
  useGetCarbonDashboardQuery,
  useGetCarbonNudgesQuery,
  useGetCompanyAnalyticsQuery,
} = corporateApi;

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
} = corporateApi;

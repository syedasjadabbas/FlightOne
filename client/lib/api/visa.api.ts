/**
 * Module 08 — Visa Intelligence API (authenticated).
 */
import { baseApi } from "@/lib/api/baseApi";

export type VisaCategory = "VISA_FREE" | "VOA" | "E_VISA" | "EMBASSY" | "UNKNOWN";

export type VisaDataStatus =
  | "VERIFIED"
  | "STALE"
  | "UNKNOWN"
  | "DATA_UNAVAILABLE"
  | "UNCONFIGURED"
  | "INCOMPLETE_INPUTS"
  | "PROVIDER_ERROR";

export type VisaRequirementView = {
  nationalityCode: string;
  destinationCode: string;
  role?: "destination" | "transit";
  category: VisaCategory;
  dataStatus: VisaDataStatus;
  isFact: boolean;
  isGuidance: boolean;
  escalateRecommended: boolean;
  source: string | null;
  lastVerifiedAt: string | null;
  confidenceNote: string;
  transitNotes?: string | null;
  transitGuidance?: {
    notes: string | null;
    airportSpecific: boolean;
    durationSpecific?: boolean;
    note: string;
  };
  requiredDocuments?: unknown;
  embassyInfo?: unknown;
  processingDaysMin?: number | null;
  processingDaysMax?: number | null;
  transit?: VisaRequirementView[];
};

export type VisaAssessment = {
  status: string;
  isFact: boolean;
  isGuidance: boolean;
  escalateRecommended: boolean;
  missingInputs: string[];
  avaSummary: string;
  requirement: VisaRequirementView | null;
  checklist: unknown;
  heldVisa: unknown;
  traveller: {
    nationality: string | null;
    hasPassport: boolean;
    passportExpiry?: string | null;
    passportExpiryStatus?: string | null;
  };
};

export type VisaApplication = {
  id: string;
  nationalityCode: string;
  destinationCode: string;
  category: VisaCategory | null;
  status: string;
  appointmentAt: string | null;
  appointmentLocation: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const visaApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVisaCapability: build.query<
      {
        provider: string;
        configured: boolean;
        canLookup: boolean;
        sourceKind: string;
        reasons: string[];
      },
      void
    >({
      query: () => "/visa/capability",
      providesTags: ["Visa"],
    }),
    lookupVisa: build.mutation<
      VisaRequirementView,
      { nationality: string; destination: string; transitCountries?: string[] }
    >({
      query: (body) => ({ url: "/visa/lookup", method: "POST", body }),
    }),
    assessVisa: build.mutation<
      VisaAssessment,
      {
        destination: string;
        nationality?: string;
        transitCountries?: string[];
        purpose?: string;
      }
    >({
      query: (body) => ({ url: "/visa/assess", method: "POST", body }),
    }),
    escalateVisa: build.mutation<
      { escalated: boolean; trigger: string; auditOnly?: boolean },
      {
        conversationId?: string;
        destination?: string;
        nationality?: string;
        reason?: string;
      }
    >({
      query: (body) => ({ url: "/visa/escalate", method: "POST", body }),
    }),
    listVisaApplications: build.query<
      { items: VisaApplication[]; total?: number },
      void
    >({
      query: () => "/visa/applications",
      providesTags: ["Visa"],
    }),
    createVisaApplication: build.mutation<
      VisaApplication,
      { nationality: string; destination: string; category?: VisaCategory; notes?: string }
    >({
      query: (body) => ({ url: "/visa/applications", method: "POST", body }),
      invalidatesTags: ["Visa"],
    }),
    updateVisaApplication: build.mutation<
      VisaApplication,
      {
        id: string;
        appointmentAt?: string | null;
        appointmentLocation?: string | null;
        status?: string;
        notes?: string | null;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/visa/applications/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Visa"],
    }),
  }),
});

export const {
  useGetVisaCapabilityQuery,
  useLookupVisaMutation,
  useAssessVisaMutation,
  useEscalateVisaMutation,
  useListVisaApplicationsQuery,
  useCreateVisaApplicationMutation,
  useUpdateVisaApplicationMutation,
} = visaApi;

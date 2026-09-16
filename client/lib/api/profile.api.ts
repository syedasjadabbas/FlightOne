import { baseApi } from "./baseApi";

/** Module 02 — Traveller Profile against `/api/v1/profile/*`. */

/** List views never request decrypted document numbers. */
export const PROFILE_DOCUMENT_LIST_PARAMS = { includeNumber: "false" } as const;

export type ProfileCompleteness = {
  score: number;
  missing: string[];
  readyForHandsFreeBooking: boolean;
};

export type TravellerProfile = {
  userId: string;
  displayName: string;
  phone: string | null;
  nationality: string | null;
  seatPref: string | null;
  mealPref: string | null;
  preferredAirlines: string[] | null;
  preferredCabin: string | null;
  maxLayoverMinutes: number | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  completeness?: ProfileCompleteness;
};

export type ProfilePatch = {
  displayName?: string;
  phone?: string | null;
  nationality?: string | null;
  seatPref?: string | null;
  mealPref?: string | null;
  preferredAirlines?: string[] | null;
  preferredCabin?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST" | null;
  maxLayoverMinutes?: number | null;
};

export type Companion = {
  id: string;
  ownerUserId: string;
  kind: "COMPANION" | "FAMILY";
  fullName: string;
  relationship: string | null;
  dateOfBirth: string | null;
  /** Only present when includePassport=true; otherwise null. */
  passportNumber: string | null;
  passportExpiry: string | null;
  hasPassport?: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type LoyaltyMembership = {
  id: string;
  profileUserId: string;
  type: "AIRLINE" | "HOTEL";
  programCode: string;
  memberNumber: string;
  createdAt: string;
};

export type EmergencyContact = {
  id: string;
  profileUserId: string;
  fullName: string;
  relationship: string | null;
  phone: string;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentExpiry = {
  state: "unknown" | "valid" | "expiring_soon" | "expired";
  daysRemaining: number | null;
  matchedLeadDays: number | null;
  isExpired: boolean;
};

export type IdentityDocument = {
  id: string;
  ownerUserId: string;
  type: "PASSPORT" | "NATIONAL_ID" | "VISA" | "RESIDENCE_PERMIT";
  documentNumber: string | null;
  countryCode: string | null;
  documentSubtype: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  vaultDocumentId: string | null;
  status: "ACTIVE" | "SUPERSEDED" | "EXPIRED";
  supersedesId: string | null;
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  verificationNote: string | null;
  companionId: string | null;
  /** True when an encrypted number is stored; list never returns the plaintext. */
  hasDocumentNumber?: boolean;
  expiry?: DocumentExpiry;
  /** Reviewable OCR payload when present — never treat as verified truth. */
  ocrExtract?: OcrExtractionResult | null;
  ocrExtractedAt?: string | null;
  ocrProvider?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OcrIdentityFields = {
  documentNumber?: string;
  countryCode?: string;
  documentSubtype?: string;
  issuedAt?: string;
  expiresAt?: string;
  fullName?: string;
  nationality?: string;
};

export type OcrExtractionResult = {
  provider: string;
  fields: OcrIdentityFields;
  confidence: number | null;
  warnings: string[];
  rawTextEcho: string | null;
};

export type DocumentOcrResult = {
  document: IdentityDocument;
  extraction: OcrExtractionResult;
  applied: false;
};

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<TravellerProfile, void>({
      query: () => "/profile",
      providesTags: ["Profile"],
    }),

    updateProfile: builder.mutation<TravellerProfile, ProfilePatch>({
      query: (body) => ({ url: "/profile", method: "PATCH", body }),
      invalidatesTags: ["Profile"],
    }),

    listCompanions: builder.query<Companion[], { kind?: "COMPANION" | "FAMILY" } | void>({
      query: (arg) => ({
        url: "/profile/companions",
        params: arg?.kind ? { kind: arg.kind } : undefined,
      }),
      providesTags: ["ProfileCompanions"],
    }),

    createCompanion: builder.mutation<
      Companion,
      {
        fullName: string;
        kind?: "COMPANION" | "FAMILY";
        relationship?: string;
        dateOfBirth?: string;
        passportNumber?: string;
        passportExpiry?: string;
      }
    >({
      query: (body) => ({ url: "/profile/companions", method: "POST", body }),
      invalidatesTags: ["ProfileCompanions", "Profile"],
    }),

    updateCompanion: builder.mutation<
      Companion,
      {
        id: string;
        patch: Partial<{
          fullName: string;
          kind: "COMPANION" | "FAMILY";
          relationship: string;
          dateOfBirth: string;
          passportNumber: string | null;
          passportExpiry: string | null;
        }>;
      }
    >({
      query: ({ id, patch }) => ({
        url: `/profile/companions/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: ["ProfileCompanions"],
    }),

    deleteCompanion: builder.mutation<void, string>({
      query: (id) => ({ url: `/profile/companions/${id}`, method: "DELETE" }),
      invalidatesTags: ["ProfileCompanions", "Profile"],
    }),

    getProfileDuplicates: builder.query<
      {
        hasDuplicates: boolean;
        companionDuplicates: unknown[];
        loyaltyDuplicates: unknown[];
        emergencyDuplicates: unknown[];
      },
      void
    >({
      query: () => "/profile/duplicates",
      providesTags: ["Profile"],
    }),

    applyProfileDedupe: builder.mutation<
      {
        merged: {
          companions: number;
          loyalty: number;
          emergencyContacts: number;
        };
        conflicts: Array<{ type: string; reason: string }>;
      },
      void
    >({
      query: () => ({ url: "/profile/dedupe", method: "POST" }),
      invalidatesTags: [
        "Profile",
        "ProfileCompanions",
        "ProfileLoyalty",
        "ProfileEmergency",
        "ProfileDocuments",
      ],
    }),

    listLoyalty: builder.query<LoyaltyMembership[], void>({
      query: () => "/profile/loyalty",
      providesTags: ["ProfileLoyalty"],
    }),

    createLoyalty: builder.mutation<
      LoyaltyMembership,
      { type: "AIRLINE" | "HOTEL"; programCode: string; memberNumber: string }
    >({
      query: (body) => ({ url: "/profile/loyalty", method: "POST", body }),
      invalidatesTags: ["ProfileLoyalty"],
    }),

    deleteLoyalty: builder.mutation<void, string>({
      query: (id) => ({ url: `/profile/loyalty/${id}`, method: "DELETE" }),
      invalidatesTags: ["ProfileLoyalty"],
    }),

    listEmergencyContacts: builder.query<EmergencyContact[], void>({
      query: () => "/profile/emergency-contacts",
      providesTags: ["ProfileEmergency"],
    }),

    createEmergencyContact: builder.mutation<
      EmergencyContact,
      {
        fullName: string;
        phone: string;
        relationship?: string;
        email?: string;
        isPrimary?: boolean;
      }
    >({
      query: (body) => ({
        url: "/profile/emergency-contacts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ProfileEmergency", "Profile"],
    }),

    deleteEmergencyContact: builder.mutation<void, string>({
      query: (id) => ({
        url: `/profile/emergency-contacts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ProfileEmergency", "Profile"],
    }),

    listDocuments: builder.query<IdentityDocument[], void>({
      query: () => ({
        url: "/profile/documents",
        params: PROFILE_DOCUMENT_LIST_PARAMS,
      }),
      providesTags: ["ProfileDocuments"],
    }),

    createDocument: builder.mutation<
      IdentityDocument,
      {
        type: IdentityDocument["type"];
        countryCode?: string;
        documentSubtype?: string;
        issuedAt?: string;
        expiresAt?: string;
        vaultDocumentId?: string;
        companionId?: string;
        documentNumber?: string;
      }
    >({
      query: (body) => ({ url: "/profile/documents", method: "POST", body }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    reuploadDocument: builder.mutation<
      IdentityDocument,
      { id: string; vaultDocumentId: string; expiresAt?: string; documentNumber?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/profile/documents/${id}/reupload`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    updateDocument: builder.mutation<
      IdentityDocument,
      {
        id: string;
        patch: Partial<{
          type: IdentityDocument["type"];
          documentNumber: string;
          countryCode: string;
          documentSubtype: string;
          issuedAt: string;
          expiresAt: string;
          vaultDocumentId: string | null;
          companionId: string;
        }>;
      }
    >({
      query: ({ id, patch }) => ({
        url: `/profile/documents/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    /** POST /profile/documents/:id/ocr — stores reviewable extract; never invents fields. */
    runDocumentOcr: builder.mutation<DocumentOcrResult, { id: string; rawText?: string }>({
      query: ({ id, rawText }) => ({
        url: `/profile/documents/${id}/ocr`,
        method: "POST",
        body: rawText != null ? { rawText } : {},
      }),
      invalidatesTags: ["ProfileDocuments"],
    }),

    /**
     * POST /profile/documents/:id/ocr/apply — applies accepted keys from stored extract only.
     * Corrected values must go through updateDocument (PATCH).
     */
    applyDocumentOcr: builder.mutation<
      IdentityDocument,
      {
        id: string;
        acceptedFields?: Array<
          "documentNumber" | "countryCode" | "documentSubtype" | "issuedAt" | "expiresAt"
        >;
      }
    >({
      query: ({ id, acceptedFields }) => ({
        url: `/profile/documents/${id}/ocr/apply`,
        method: "POST",
        body: acceptedFields?.length ? { acceptedFields } : {},
      }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    verifyDocument: builder.mutation<
      IdentityDocument,
      { id: string; decision: "PENDING" | "VERIFIED" | "REJECTED"; note?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/profile/documents/${id}/verify`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    deleteDocument: builder.mutation<void, string>({
      query: (id) => ({ url: `/profile/documents/${id}`, method: "DELETE" }),
      invalidatesTags: ["ProfileDocuments", "Profile"],
    }),

    getTravelHistory: builder.query<
      {
        items: Array<{
          id: string;
          status: string;
          product: string;
          currency: string;
          amountMinor: number;
          supplierCode: string | null;
          externalRef: string | null;
          createdAt: string;
        }>;
        stats: { totalBookings: number; completedBookings: number };
        patterns?: {
          frequentRoutes?: string[];
          frequentAirlines?: string[];
        };
      },
      { limit?: number } | void
    >({
      query: (params) => ({
        url: "/profile/history",
        params: params || undefined,
      }),
      providesTags: ["Profile"],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useListCompanionsQuery,
  useCreateCompanionMutation,
  useUpdateCompanionMutation,
  useDeleteCompanionMutation,
  useGetProfileDuplicatesQuery,
  useApplyProfileDedupeMutation,
  useListLoyaltyQuery,
  useGetTravelHistoryQuery,
  useCreateLoyaltyMutation,
  useDeleteLoyaltyMutation,
  useListEmergencyContactsQuery,
  useCreateEmergencyContactMutation,
  useDeleteEmergencyContactMutation,
  useListDocumentsQuery,
  useCreateDocumentMutation,
  useReuploadDocumentMutation,
  useUpdateDocumentMutation,
  useRunDocumentOcrMutation,
  useApplyDocumentOcrMutation,
  useVerifyDocumentMutation,
  useDeleteDocumentMutation,
} = profileApi;

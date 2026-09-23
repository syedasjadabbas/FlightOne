/**
 * Module 07 — Traveller Vault API (authenticated).
 * Binary upload/download; metadata never includes storage keys or raw bytes.
 */
import { baseApi } from "@/lib/api/baseApi";
import { API_BASE_URL } from "@/lib/api/baseApi";

export type VaultDocType =
  | "PASSPORT"
  | "NATIONAL_ID"
  | "RESIDENCE_PERMIT"
  | "VISA"
  | "TICKET"
  | "HOTEL_VOUCHER"
  | "INSURANCE"
  | "FF_CARD"
  | "LOYALTY_CARD"
  | "TRAVEL_CERT"
  | "OTHER";

export type VaultStorageCapability = {
  provider: string;
  configured: boolean;
  canUpload: boolean;
  canDownload: boolean;
  maxBytes: number;
  allowedMimeTypes: string[];
  reasons: string[];
};

export type VaultDocument = {
  id: string;
  ownerUserId: string;
  companionId: string | null;
  type: VaultDocType;
  title: string;
  bookingId: string | null;
  issueDate: string | null;
  expiresAt: string | null;
  fileUrl: string | null;
  fileMeta: Record<string, unknown> | null;
  contentType: string | null;
  byteSize: number | null;
  originalFilename: string | null;
  version: number;
  supersedesId: string | null;
  isActive: boolean;
  hasBinary: boolean;
  lifecycleStatus?: "ACTIVE" | "EXPIRED" | "SUPERSEDED";
  expiryStatus?: "unknown" | "valid" | "expiring_soon" | "expired";
  daysUntilExpiry?: number | null;
  isPlatformIssued?: boolean;
  visaMeta?: VaultVisaMeta | null;
  visaIntelligence?: VaultVisaIntelligence | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultVisaHolderStatus = "ISSUED" | "PENDING" | "IN_PROCESS" | "CANCELLED";

export type VaultVisaMeta = {
  destinationCode: string | null;
  visaType: string | null;
  holderStatus: VaultVisaHolderStatus;
  visaStatus: string;
  visaApplicationId: string | null;
  appointmentAt: string | null;
  appointmentLocation: string | null;
  issuingAuthority: string | null;
  remindersEnabled: boolean;
};

export type VaultVisaMetaInput = {
  destinationCode?: string | null;
  visaType?: string | null;
  holderStatus?: VaultVisaHolderStatus;
  visaApplicationId?: string | null;
  appointmentAt?: string | null;
  appointmentLocation?: string | null;
  issuingAuthority?: string | null;
  remindersEnabled?: boolean;
};

export type VaultVisaIntelligence = {
  dataStatus: string;
  isFact: boolean;
  isGuidance: boolean;
  category: string | null;
  source: string | null;
  lastVerifiedAt: string | null;
  embassyInfo: unknown;
  processingDaysMin: number | null;
  processingDaysMax: number | null;
  requiredDocuments: unknown;
  confidenceNote: string;
  linkedApplication: {
    id: string;
    status: string;
    appointmentAt: string | null;
    appointmentLocation: string | null;
    destinationCode: string;
    nationalityCode: string;
    category: string | null;
  } | null;
  nationalityCode?: string;
  destinationCode?: string;
};

export const vaultApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVaultCapability: build.query<VaultStorageCapability, void>({
      query: () => "/vault/capability",
      providesTags: ["Vault"],
    }),
    listVaultDocuments: build.query<
      { items: VaultDocument[]; total: number },
      {
        type?: VaultDocType;
        expiringWithinDays?: number;
        includeInactive?: boolean;
        companionId?: string;
        destinationCode?: string;
      } | void
    >({
      query: (params) => ({
        url: "/vault",
        params: params
          ? {
              ...params,
              includeInactive: params.includeInactive ? "true" : undefined,
            }
          : undefined,
      }),
      providesTags: ["Vault"],
    }),
    getVaultDocument: build.query<VaultDocument, string>({
      query: (id) => `/vault/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Vault" as const, id }],
    }),
    createVaultDocument: build.mutation<
      VaultDocument,
      {
        type: VaultDocType;
        title: string;
        companionId?: string;
        issueDate?: string;
        expiresAt?: string;
        visaMeta?: VaultVisaMetaInput;
      }
    >({
      query: (body) => ({ url: "/vault", method: "POST", body }),
      invalidatesTags: ["Vault"],
    }),
    uploadVaultDocument: build.mutation<
      VaultDocument,
      {
        type: VaultDocType;
        title: string;
        contentType: string;
        originalFilename: string;
        /** Preferred: GCS public URL after signed client upload. */
        fileUrl?: string;
        byteSize?: number;
        /** Legacy / server-side path. */
        contentBase64?: string;
        companionId?: string;
        issueDate?: string;
        expiresAt?: string;
        visaMeta?: VaultVisaMetaInput;
      }
    >({
      query: (body) => ({ url: "/vault/upload", method: "POST", body }),
      invalidatesTags: ["Vault"],
    }),
    updateVaultDocument: build.mutation<
      VaultDocument,
      {
        id: string;
        title?: string;
        issueDate?: string | null;
        expiresAt?: string | null;
        visaMeta?: VaultVisaMetaInput;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/vault/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Vault"],
    }),
    replaceVaultDocument: build.mutation<
      VaultDocument,
      {
        id: string;
        fileUrl?: string;
        byteSize?: number;
        contentBase64?: string;
        contentType?: string;
        originalFilename?: string;
        title?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/vault/${id}/replace`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Vault"],
    }),
    deleteVaultDocument: build.mutation<VaultDocument, string>({
      query: (id) => ({ url: `/vault/${id}`, method: "DELETE" }),
      invalidatesTags: ["Vault"],
    }),
    shareVaultDocument: build.mutation<
      { token: string; expiresAt: string },
      { id: string; ttlHours?: number }
    >({
      query: ({ id, ttlHours }) => ({
        url: `/vault/${id}/share`,
        method: "POST",
        body: ttlHours != null ? { ttlHours } : {},
      }),
    }),
  }),
});

export const {
  useGetVaultCapabilityQuery,
  useListVaultDocumentsQuery,
  useGetVaultDocumentQuery,
  useCreateVaultDocumentMutation,
  useUploadVaultDocumentMutation,
  useUpdateVaultDocumentMutation,
  useReplaceVaultDocumentMutation,
  useDeleteVaultDocumentMutation,
  useShareVaultDocumentMutation,
} = vaultApi;

import { getApiBaseUrl, CSRF_HEADER } from "@/lib/api/baseApi";
import { useAuthStore } from "@/store/auth.store";
import { refreshSessionOnce } from "@/lib/auth/refreshSession";

/** Authenticated binary download (blob) — not via RTK Query JSON. */
export async function downloadVaultDocumentBlob(
  documentId: string,
  accessToken?: string,
  apiBase?: string,
): Promise<Blob> {
  const base = apiBase || getApiBaseUrl();
  let token = accessToken || useAuthStore.getState().accessToken;

  const doFetch = async (t?: string | null) => {
    const headers: Record<string, string> = {
      [CSRF_HEADER]: "1",
    };
    if (t) {
      headers.Authorization = `Bearer ${t}`;
    }
    return fetch(`${base}/vault/${documentId}/download`, {
      headers,
      credentials: "include",
    });
  };

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshSessionOnce({ force: true });
    if (refreshed) {
      token = useAuthStore.getState().accessToken;
      res = await doFetch(token);
    }
  }

  if (!res.ok) {
    throw new Error(`Vault download failed (${res.status})`);
  }
  return res.blob();
}


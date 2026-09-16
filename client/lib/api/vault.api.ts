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
  isPlatformIssued?: boolean;
  createdAt: string;
  updatedAt: string;
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
        contentBase64: string;
        companionId?: string;
        issueDate?: string;
        expiresAt?: string;
      }
    >({
      query: (body) => ({ url: "/vault/upload", method: "POST", body }),
      invalidatesTags: ["Vault"],
    }),
    replaceVaultDocument: build.mutation<
      VaultDocument,
      {
        id: string;
        contentBase64: string;
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
  useReplaceVaultDocumentMutation,
  useDeleteVaultDocumentMutation,
  useShareVaultDocumentMutation,
} = vaultApi;

/** Authenticated binary download (blob) — not via RTK Query JSON. */
export async function downloadVaultDocumentBlob(
  documentId: string,
  accessToken: string,
  apiBase = API_BASE_URL,
): Promise<Blob> {
  const res = await fetch(`${apiBase}/vault/${documentId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Vault download failed (${res.status})`);
  }
  return res.blob();
}

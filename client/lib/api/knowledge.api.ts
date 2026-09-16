/**
 * Module 16 — Knowledge Platform API client (ops).
 */
import { baseApi } from "@/lib/api/baseApi";

export type KnowledgeCategory =
  | "SOP"
  | "AIRLINE_POLICY"
  | "SUPPLIER_RULE"
  | "CORPORATE_TRAVEL_POLICY"
  | "VISA_RULE"
  | "SUPPLIER_CONTRACT"
  | "VISA_PROCEDURE"
  | "CORPORATE_AGREEMENT"
  | "TRAVEL_POLICY"
  | "VISA"
  | "CORPORATE"
  | "OTHER";

export type KnowledgeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "EXPIRED";
export type KnowledgeVisibility = "CUSTOMER_SAFE" | "INTERNAL" | "RESTRICTED";

export type KnowledgeDocument = {
  id: string;
  documentKey: string;
  title: string;
  category: KnowledgeCategory;
  visibility: KnowledgeVisibility;
  status: KnowledgeStatus;
  version: number;
  source?: string | null;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  lastVerifiedAt?: string | null;
  ingestionStatus?: string;
  ingestionError?: string | null;
  content?: string;
  chunkCount?: number;
  chunks?: Array<{ id: string; ordinal: number; content: string }>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeListPage = {
  items: KnowledgeDocument[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const knowledgeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listKnowledgeDocuments: build.query<
      KnowledgeListPage,
      {
        category?: KnowledgeCategory;
        status?: KnowledgeStatus;
        visibility?: KnowledgeVisibility;
        q?: string;
        page?: number;
      } | void
    >({
      query: (params) => ({ url: "/knowledge/documents", params: params || undefined }),
      providesTags: ["Knowledge"],
    }),
    getKnowledgeDocument: build.query<KnowledgeDocument, string>({
      query: (id) => `/knowledge/documents/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Knowledge", id }],
    }),
    createKnowledgeDocument: build.mutation<
      KnowledgeDocument,
      {
        title: string;
        category: KnowledgeCategory;
        content: string;
        visibility?: KnowledgeVisibility;
        source?: string;
        publish?: boolean;
        effectiveFrom?: string | null;
        expiresAt?: string | null;
      }
    >({
      query: (body) => ({ url: "/knowledge/documents", method: "POST", body }),
      invalidatesTags: ["Knowledge"],
    }),
    createKnowledgeVersion: build.mutation<
      KnowledgeDocument,
      { id: string; content: string; publish?: boolean; title?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/knowledge/documents/${id}/versions`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Knowledge"],
    }),
    publishKnowledgeDocument: build.mutation<KnowledgeDocument, string>({
      query: (id) => ({ url: `/knowledge/documents/${id}/publish`, method: "POST" }),
      invalidatesTags: ["Knowledge"],
    }),
    archiveKnowledgeDocument: build.mutation<KnowledgeDocument, string>({
      query: (id) => ({ url: `/knowledge/documents/${id}/archive`, method: "POST" }),
      invalidatesTags: ["Knowledge"],
    }),
    retrieveKnowledge: build.mutation<
      {
        hits: Array<{
          documentId: string;
          title: string;
          version: number;
          category: string;
          score: number;
          content?: string | null;
        }>;
        coverage: string;
        possibleConflict?: boolean;
      },
      { query: string; limit?: number; mode?: "ava" | "ops" }
    >({
      query: (body) => ({ url: "/knowledge/retrieve", method: "POST", body }),
    }),
  }),
});

export const {
  useListKnowledgeDocumentsQuery,
  useGetKnowledgeDocumentQuery,
  useCreateKnowledgeDocumentMutation,
  useCreateKnowledgeVersionMutation,
  usePublishKnowledgeDocumentMutation,
  useArchiveKnowledgeDocumentMutation,
  useRetrieveKnowledgeMutation,
} = knowledgeApi;

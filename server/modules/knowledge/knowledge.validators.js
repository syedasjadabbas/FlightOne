import { z } from "zod";

/** Exact Module 16 PRD categories (+ legacy retained for read compat). */
export const KNOWLEDGE_CATEGORIES = [
  "SOP",
  "AIRLINE_POLICY",
  "SUPPLIER_RULE",
  "CORPORATE_TRAVEL_POLICY",
  "VISA_RULE",
  "SUPPLIER_CONTRACT",
  "VISA_PROCEDURE",
  "CORPORATE_AGREEMENT",
  "TRAVEL_POLICY",
];

export const KNOWLEDGE_CATEGORIES_INCLUDING_LEGACY = [
  ...KNOWLEDGE_CATEGORIES,
  "VISA",
  "CORPORATE",
  "OTHER",
];

export const KNOWLEDGE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED", "EXPIRED"];
export const KNOWLEDGE_VISIBILITIES = ["CUSTOMER_SAFE", "INTERNAL", "RESTRICTED"];

export const createKnowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  category: z.enum(KNOWLEDGE_CATEGORIES),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  source: z.string().trim().min(1).max(300).optional(),
  documentKey: z.string().trim().min(1).max(120).optional(),
  version: z.number().int().positive().optional(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  lastVerifiedAt: z.coerce.date().optional().nullable(),
  content: z.string().trim().min(1).max(200_000),
  publish: z.boolean().optional(),
});

export const createVersionSchema = z.object({
  content: z.string().trim().min(1).max(200_000),
  title: z.string().trim().min(1).max(300).optional(),
  source: z.string().trim().min(1).max(300).optional(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  lastVerifiedAt: z.coerce.date().optional().nullable(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  publish: z.boolean().optional(),
});

export const updateMetadataSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  source: z.string().trim().min(1).max(300).optional().nullable(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  lastVerifiedAt: z.coerce.date().optional().nullable(),
});

export const listKnowledgeDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  category: z.enum(KNOWLEDGE_CATEGORIES_INCLUDING_LEGACY).optional(),
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  documentKey: z.string().trim().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const retrieveKnowledgeSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  categories: z.array(z.enum(KNOWLEDGE_CATEGORIES_INCLUDING_LEGACY)).max(9).optional(),
  mode: z.enum(["ava", "ops"]).optional(),
});

export const avaGuidanceQuerySchema = z.object({
  q: z.string().trim().min(1).max(500).optional(),
  query: z.string().trim().min(1).max(500).optional(),
});

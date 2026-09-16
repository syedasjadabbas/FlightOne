import { z } from "zod";

export const VAULT_DOC_TYPES = [
  "PASSPORT",
  "NATIONAL_ID",
  "RESIDENCE_PERMIT",
  "VISA",
  "TICKET",
  "HOTEL_VOUCHER",
  "INSURANCE",
  "FF_CARD",
  "LOYALTY_CARD",
  "TRAVEL_CERT",
  "OTHER",
];

export const vaultDocIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Document id is required"),
});

export const publicShareTokenParamsSchema = z.object({
  token: z.string().trim().min(1, "Share token is required"),
});

export const listVaultDocumentsQuerySchema = z.object({
  type: z.enum(VAULT_DOC_TYPES).optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
  includeInactive: z.string().optional(),
  companionId: z.string().trim().min(1).optional(),
});

const metadataFields = {
  type: z.enum(VAULT_DOC_TYPES),
  title: z.string().trim().min(1).max(200),
  companionId: z.string().trim().min(1).optional(),
  bookingId: z.string().trim().min(1).optional(),
  issueDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  fileMeta: z.record(z.any()).optional(),
};

export const createVaultDocumentSchema = z
  .object({
    ...metadataFields,
  })
  .strict();

export const uploadVaultDocumentSchema = z
  .object({
    ...metadataFields,
    contentType: z.string().trim().min(3).max(100),
    originalFilename: z.string().trim().min(1).max(200),
    contentBase64: z.string().min(1).max(20_000_000),
  })
  .strict();

export const replaceVaultBinarySchema = z
  .object({
    contentType: z.string().trim().min(3).max(100).optional(),
    originalFilename: z.string().trim().min(1).max(200).optional(),
    contentBase64: z.string().min(1).max(20_000_000),
    title: z.string().trim().min(1).max(200).optional(),
    issueDate: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const updateVaultDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    companionId: z.string().trim().min(1).nullable().optional(),
    issueDate: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    fileMeta: z.record(z.any()).nullable().optional(),
    encryptedNote: z.string().max(10000).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

export const shareVaultDocumentSchema = z.object({
  ttlHours: z.number().int().min(1).max(24 * 30).optional(),
});

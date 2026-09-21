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

export const VAULT_VISA_HOLDER_STATUSES = [
  "ISSUED",
  "PENDING",
  "IN_PROCESS",
  "CANCELLED",
];

const iso2Code = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "must be an ISO 3166-1 alpha-2 country code")
  .transform((v) => v.toUpperCase());

export const vaultVisaMetaSchema = z
  .object({
    destinationCode: iso2Code.nullable().optional(),
    visaType: z.string().trim().min(1).max(80).nullable().optional(),
    holderStatus: z.enum(VAULT_VISA_HOLDER_STATUSES).optional(),
    visaApplicationId: z.string().trim().min(1).nullable().optional(),
    appointmentAt: z.coerce.date().nullable().optional(),
    appointmentLocation: z.string().trim().max(300).nullable().optional(),
    issuingAuthority: z.string().trim().max(200).nullable().optional(),
    remindersEnabled: z.boolean().optional(),
  })
  .strict();

export const listVaultDocumentsQuerySchema = z.object({
  type: z.enum(VAULT_DOC_TYPES).optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
  includeInactive: z.string().optional(),
  companionId: z.string().trim().min(1).optional(),
  destinationCode: iso2Code.optional(),
});

const metadataFields = {
  type: z.enum(VAULT_DOC_TYPES),
  title: z.string().trim().min(1).max(200),
  companionId: z.string().trim().min(1).optional(),
  bookingId: z.string().trim().min(1).optional(),
  issueDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  fileMeta: z.record(z.any()).optional(),
  visaMeta: vaultVisaMetaSchema.optional(),
};

function rejectVisaMetaUnlessVisa(body) {
  if (!body.visaMeta) return true;
  return body.type === "VISA";
}

export const createVaultDocumentSchema = z
  .object({
    ...metadataFields,
  })
  .strict()
  .refine(rejectVisaMetaUnlessVisa, {
    message: "visaMeta is only allowed for VISA documents",
    path: ["visaMeta"],
  });

export const uploadVaultDocumentSchema = z
  .object({
    ...metadataFields,
    contentType: z.string().trim().min(3).max(100),
    originalFilename: z.string().trim().min(1).max(200),
    contentBase64: z.string().min(1).max(20_000_000).optional(),
    fileUrl: z.string().url().max(2048).optional(),
    byteSize: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.contentBase64) !== Boolean(body.fileUrl), {
    message: "Provide exactly one of fileUrl or contentBase64",
  })
  .refine((body) => !body.fileUrl || body.byteSize != null, {
    message: "byteSize is required when fileUrl is provided",
    path: ["byteSize"],
  })
  .refine(rejectVisaMetaUnlessVisa, {
    message: "visaMeta is only allowed for VISA documents",
    path: ["visaMeta"],
  });

export const replaceVaultBinarySchema = z
  .object({
    contentType: z.string().trim().min(3).max(100).optional(),
    originalFilename: z.string().trim().min(1).max(200).optional(),
    contentBase64: z.string().min(1).max(20_000_000).optional(),
    fileUrl: z.string().url().max(2048).optional(),
    byteSize: z.number().int().positive().max(10 * 1024 * 1024).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    issueDate: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((body) => Boolean(body.contentBase64) !== Boolean(body.fileUrl), {
    message: "Provide exactly one of fileUrl or contentBase64",
  })
  .refine((body) => !body.fileUrl || body.byteSize != null, {
    message: "byteSize is required when fileUrl is provided",
    path: ["byteSize"],
  });

export const updateVaultDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    companionId: z.string().trim().min(1).nullable().optional(),
    issueDate: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    fileMeta: z.record(z.any()).nullable().optional(),
    encryptedNote: z.string().max(10000).nullable().optional(),
    visaMeta: vaultVisaMetaSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

export const shareVaultDocumentSchema = z.object({
  ttlHours: z.number().int().min(1).max(24 * 30).optional(),
});

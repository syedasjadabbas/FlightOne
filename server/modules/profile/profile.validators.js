import { z } from "zod";

const isoDateString = z.coerce.date();

const cabinEnum = z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]);

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(3).max(32).nullable().optional(),
    nationality: z
      .string()
      .trim()
      .length(2)
      .transform((s) => s.toUpperCase())
      .nullable()
      .optional(),
    seatPref: z.string().trim().min(1).max(60).nullable().optional(),
    mealPref: z.string().trim().min(1).max(120).nullable().optional(),
    preferredAirlines: z.array(z.string().trim().min(1).max(10)).max(50).nullable().optional(),
    preferredCabin: cabinEnum.nullable().optional(),
    maxLayoverMinutes: z.number().int().min(0).max(48 * 60).nullable().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const createCompanionSchema = z
  .object({
    kind: z.enum(["COMPANION", "FAMILY"]).optional(),
    fullName: z.string().trim().min(1).max(120),
    relationship: z.string().trim().min(1).max(60).optional(),
    dateOfBirth: isoDateString.optional(),
    passportNumber: z.string().trim().min(3).max(20).optional(),
    passportExpiry: isoDateString.optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const updateCompanionSchema = createCompanionSchema.partial().strict();

export const companionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const listCompanionsQuerySchema = z
  .object({
    kind: z.enum(["COMPANION", "FAMILY"]).optional(),
    includePassport: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional(),
  })
  .strict();

export const createLoyaltySchema = z
  .object({
    type: z.enum(["AIRLINE", "HOTEL"]),
    programCode: z.string().trim().min(1).max(20),
    memberNumber: z.string().trim().min(1).max(40),
  })
  .strict();

export const updateLoyaltySchema = createLoyaltySchema.partial().strict();

export const loyaltyIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const identityDocType = z.enum([
  "PASSPORT",
  "NATIONAL_ID",
  "VISA",
  "RESIDENCE_PERMIT",
]);

const countryCode = z
  .string()
  .trim()
  .length(2)
  .transform((s) => s.toUpperCase());

const identityDocumentFields = {
  type: identityDocType,
  documentNumber: z.string().trim().min(3).max(40).optional(),
  countryCode: countryCode.optional(),
  documentSubtype: z.string().trim().min(1).max(80).optional(),
  issuedAt: isoDateString.optional(),
  expiresAt: isoDateString.optional(),
  vaultDocumentId: z.string().trim().min(1).max(64).nullable().optional(),
  companionId: z.string().trim().min(1).optional(),
  supersedesId: z.string().trim().min(1).optional(),
  metadata: z.record(z.any()).optional(),
};

function refineDocumentDates(val, ctx) {
  if (val.issuedAt && val.expiresAt && val.expiresAt < val.issuedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiresAt must be on or after issuedAt",
      path: ["expiresAt"],
    });
  }
}

export const createIdentityDocumentSchema = z
  .object(identityDocumentFields)
  .strict()
  .superRefine(refineDocumentDates);

export const updateIdentityDocumentSchema = z
  .object({
    type: identityDocType.optional(),
    documentNumber: z.string().trim().min(3).max(40).optional(),
    countryCode: countryCode.optional(),
    documentSubtype: z.string().trim().min(1).max(80).optional(),
    issuedAt: isoDateString.optional(),
    expiresAt: isoDateString.optional(),
    vaultDocumentId: z.string().trim().min(1).max(64).nullable().optional(),
    companionId: z.string().trim().min(1).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict()
  .superRefine(refineDocumentDates);

export const identityDocumentIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const listIdentityDocumentsQuerySchema = z
  .object({
    type: identityDocType.optional(),
    status: z.enum(["ACTIVE", "SUPERSEDED", "EXPIRED"]).optional(),
    companionId: z.string().trim().min(1).optional(),
    includeNumber: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional(),
  })
  .strict();

export const reuploadIdentityDocumentSchema = z
  .object({
    vaultDocumentId: z.string().trim().min(1).max(64),
    type: identityDocType.optional(),
    documentNumber: z.string().trim().min(3).max(40).optional(),
    countryCode: countryCode.optional(),
    documentSubtype: z.string().trim().min(1).max(80).optional(),
    issuedAt: isoDateString.optional(),
    expiresAt: isoDateString.optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.issuedAt && val.expiresAt && val.expiresAt < val.issuedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAt must be on or after issuedAt",
        path: ["expiresAt"],
      });
    }
  });

export const verifyIdentityDocumentSchema = z
  .object({
    decision: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const runOcrSchema = z
  .object({
    // Optional pass-through to configured HTTP OCR — never treated as extracted fields locally.
    rawText: z.string().max(20000).optional(),
  })
  .strict();

export const applyOcrSchema = z
  .object({
    acceptedFields: z
      .array(
        z.enum([
          "documentNumber",
          "countryCode",
          "documentSubtype",
          "issuedAt",
          "expiresAt",
        ]),
      )
      .max(10)
      .optional(),
  })
  .strict();

export const createEmergencyContactSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    relationship: z.string().trim().min(1).max(60).optional(),
    phone: z.string().trim().min(3).max(32),
    email: z.string().trim().email().max(200).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const updateEmergencyContactSchema = createEmergencyContactSchema
  .partial()
  .strict();

export const emergencyContactIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const travelHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

import { z } from "zod";

export const VISA_CATEGORIES = ["VISA_FREE", "VOA", "E_VISA", "EMBASSY", "UNKNOWN"];

export const VISA_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_PROCESS",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

const iso2Code = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "must be an ISO 3166-1 alpha-2 country code")
  .transform((v) => v.toUpperCase());

const iso2CodeCsv = z
  .string()
  .trim()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine((codes) => codes.every((c) => /^[A-Za-z]{2}$/.test(c)), {
    message: "transit must be a comma-separated list of ISO2 country codes",
  })
  .transform((codes) => codes.map((c) => c.toUpperCase()));

export const getRequirementsQuerySchema = z.object({
  nationality: iso2Code,
  destination: iso2Code,
  transit: iso2CodeCsv.optional(),
});

export const lookupVisaSchema = z.object({
  nationality: iso2Code,
  destination: iso2Code,
  transitCountries: z.array(iso2Code).max(10).optional(),
});

export const assessVisaSchema = z.object({
  destination: iso2Code,
  nationality: iso2Code.optional(),
  transitCountries: z.array(iso2Code).max(10).optional(),
  purpose: z.string().trim().max(200).optional(),
});

export const escalateVisaSchema = z.object({
  conversationId: z.string().trim().min(1).optional(),
  bookingId: z.string().trim().min(1).optional(),
  destination: iso2Code.optional(),
  nationality: iso2Code.optional(),
  transitCountries: z.array(iso2Code).max(10).optional(),
  purpose: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const createVisaApplicationSchema = z.object({
  nationality: iso2Code,
  destination: iso2Code,
  category: z.enum(VISA_CATEGORIES).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const listVisaApplicationsQuerySchema = z.object({
  status: z.enum(VISA_APPLICATION_STATUSES).optional(),
  userId: z.string().trim().min(1).optional(),
  all: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const visaApplicationIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Application id is required"),
});

export const updateVisaApplicationSchema = z
  .object({
    status: z.enum(VISA_APPLICATION_STATUSES).optional(),
    appointmentAt: z.coerce.date().nullable().optional(),
    appointmentLocation: z.string().trim().max(300).nullable().optional(),
    checklist: z.union([z.array(z.any()), z.record(z.any())]).nullable().optional(),
    vaultDocumentIds: z.array(z.string().trim().min(1)).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

import { z } from "zod";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  COMPANY_MEMBERSHIP_ROLES,
  CORPORATE_INVOICE_STATUSES,
  PROJECT_CODE_MAX_LEN,
  PROJECT_CODE_NAME_MAX_LEN,
} from "./corporate.constants.js";

export {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  COMPANY_MEMBERSHIP_ROLES,
} from "./corporate.constants.js";

export const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Optional: ordinary users create with credit 0; non-zero requires corporate:company:write (service).
  creditLimitMinor: z.number().int().nonnegative().optional(),
  currency: z
    .string()
    .trim()
    .length(3, "currency must be a 3-letter ISO 4217 code")
    .transform((v) => v.toUpperCase())
    .optional(),
  billingCycle: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
  markupBps: z.number().int().nonnegative().max(10000).optional().nullable(),
});

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    creditLimitMinor: z.number().int().nonnegative().optional(),
    billingCycle: z.string().trim().min(1).max(40).nullable().optional(),
    isActive: z.boolean().optional(),
    markupBps: z.number().int().nonnegative().max(10000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const companyIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const memberUserParamsSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

export const policyIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  policyId: z.string().trim().min(1),
});

export const bookingIdParamsSchema = z.object({
  bookingId: z.string().trim().min(1),
});

export const addMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(COMPANY_MEMBERSHIP_ROLES).default("MEMBER"),
  department: z.string().trim().min(1).max(120).optional(),
  costCentre: z.string().trim().min(1).max(120).optional(),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(COMPANY_MEMBERSHIP_ROLES).optional(),
    department: z.string().trim().min(1).max(120).nullable().optional(),
    costCentre: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const createPolicySchema = z.object({
  name: z.string().trim().min(1).max(200),
  maxCabin: z.string().trim().min(1).max(40).optional(),
  maxAmountMinor: z.number().int().nonnegative().optional(),
  preferredAirlines: z.array(z.string().trim().min(1).max(10)).optional(),
  advanceBookingDays: z.number().int().nonnegative().optional(),
});

export const updatePolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    maxCabin: z.string().trim().min(1).max(40).nullable().optional(),
    maxAmountMinor: z.number().int().nonnegative().nullable().optional(),
    preferredAirlines: z.array(z.string().trim().min(1).max(10)).nullable().optional(),
    advanceBookingDays: z.number().int().nonnegative().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const evaluatePolicySchema = z.object({
  amountMinor: z.number().int().nonnegative().optional(),
  cabin: z.string().trim().min(1).max(40).optional(),
  airline: z.string().trim().min(1).max(10).optional(),
  departureDate: z.string().trim().min(1).max(40).optional(),
});

export const createApprovalSchema = z.object({
  bookingId: z.string().trim().min(1),
  companyId: z.string().trim().min(1),
});

export const listApprovalsQuerySchema = z.object({
  status: z.enum(APPROVAL_STATUSES).optional(),
  companyId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const approvalIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const decideApprovalSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  note: z.string().trim().min(1).max(1000).optional(),
});

const projectCodeValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(PROJECT_CODE_MAX_LEN)
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9][A-Z0-9._/-]*$/.test(v), {
    message: "Project code must be alphanumeric (with . _ / -)",
  });

const projectCodeNameSchema = z.string().trim().min(1).max(PROJECT_CODE_NAME_MAX_LEN);

export const projectCodeIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  projectCodeId: z.string().trim().min(1),
});

export const createProjectCodeSchema = z.object({
  code: projectCodeValueSchema,
  name: projectCodeNameSchema,
  isActive: z.boolean().optional(),
});

export const updateProjectCodeSchema = z
  .object({
    code: projectCodeValueSchema.optional(),
    name: projectCodeNameSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const listProjectCodesQuerySchema = z.object({
  activeOnly: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1";
    }),
});

export const setBookingProjectCodeSchema = z.object({
  projectCodeId: z.string().trim().min(1),
});

export const invoiceIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  invoiceId: z.string().trim().min(1),
});

export const issueInvoiceSchema = z.object({
  bookingId: z.string().trim().min(1),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(CORPORATE_INVOICE_STATUSES),
});

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "colour must be #RRGGBB")
  .nullable()
  .optional();

export const updateBrandingSchema = z
  .object({
    portalName: z.string().trim().min(1).max(120).optional(),
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    logoUrl: z.string().trim().max(500).nullable().optional(),
    primaryColor: hexColor,
    secondaryColor: hexColor,
    portalEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const configureDomainSchema = z.object({
  hostname: z.string().trim().min(1).max(253),
});

export const updateSsoSchema = z
  .object({
    providerType: z.enum(["oidc", "saml", "unconfigured"]).optional(),
    issuer: z.string().trim().max(400).nullable().optional(),
    clientId: z.string().trim().max(200).nullable().optional(),
    clientSecret: z.string().trim().min(1).max(400).optional(),
    metadataUrl: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const resolvePortalQuerySchema = z.object({
  host: z.string().trim().min(1).max(253),
});

export const expenseIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  expenseId: z.string().trim().min(1),
});

export const createExpenseSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  category: z.string().trim().min(1).max(40).optional(),
  merchant: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
  expenseDate: z.string().trim().min(8).max(40).optional(),
  bookingId: z.string().trim().min(1).optional(),
  days: z.number().int().min(1).max(60).optional(),
});

export const updateExpenseSchema = z
  .object({
    amountMinor: z.number().int().nonnegative().optional(),
    category: z.string().trim().min(1).max(40).optional(),
    merchant: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    expenseDate: z.string().trim().min(8).max(40).optional(),
    bookingId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const expenseReceiptSchema = z.object({
  contentBase64: z.string().min(1).max(20_000_000),
  contentType: z.string().trim().min(1).max(80),
  originalFilename: z.string().trim().min(1).max(180).optional(),
});

export const decideExpenseSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
});

export const listExpensesQuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "REIMBURSEMENT_PENDING",
      "REIMBURSED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const upsertPerDiemSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  dailyAmountMinor: z.number().int().nonnegative(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  isActive: z.boolean().optional(),
});

export const quotePerDiemQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).optional(),
});

export const carbonDashboardQuerySchema = z.object({
  from: z.string().trim().min(8).max(16).optional(),
  to: z.string().trim().min(8).max(16).optional(),
});

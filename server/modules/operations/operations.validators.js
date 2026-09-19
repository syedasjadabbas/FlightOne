import { z } from "zod";

export const OPS_EVENT_TYPES = [
  "BOOKING_CREATED",
  "BOOKING_RESERVED",
  "BOOKING_TICKETED",
  "BOOKING_CANCELLED",
  "BOOKING_REFUNDED",
  "BOOKING_FULFILMENT_FAILED",
  "PAYMENT_CAPTURED",
  "CUSTOMER_UPSERTED",
  "REFUND_REQUESTED",
  "ESCALATION_CREATED",
];

export const OPS_OUTBOX_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
  "SKIPPED_UNCONFIGURED",
];

export const SUPPLIER_RECON_STATUSES = [
  "OPEN",
  "MATCHED",
  "DISCREPANCY",
  "MISMATCH",
  "DATA_UNAVAILABLE",
  "UNCONFIGURED",
  "REQUIRES_REVIEW",
];

export const drainOutboxSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  eventId: z.string().trim().min(1).optional(),
});

export const retryOutboxSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  eventId: z.string().trim().min(1).optional(),
});

export const listOutboxQuerySchema = z.object({
  status: z.enum(OPS_OUTBOX_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listAccountingQuerySchema = z.object({
  bookingId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  entryType: z
    .enum(["REVENUE", "COST", "COMMISSION", "REFUND", "PAYMENT", "MARGIN", "CREDIT"])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listFinanceQuerySchema = z.object({
  bookingId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listCommissionsQuerySchema = z.object({
  bookingId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const createReconciliationSchema = z
  .object({
    supplierCode: z.string().trim().min(1).max(40).optional(),
    externalRef: z.string().trim().min(1).max(120).optional(),
    bookingId: z.string().trim().min(1).optional(),
    expectedMinor: z.number().int().nonnegative().optional(),
    invoicedMinor: z.number().int().nonnegative().optional().nullable(),
    currency: z.string().trim().length(3).optional(),
    notes: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().min(1).max(160).optional(),
  })
  .refine((d) => Boolean(d.bookingId) || (d.supplierCode && d.expectedMinor != null), {
    message: "bookingId or (supplierCode + expectedMinor) is required",
  });

export const listReconciliationQuerySchema = z.object({
  status: z.enum(SUPPLIER_RECON_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const listAuditQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  resourceType: z.string().trim().min(1).max(60).optional(),
  resourceId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

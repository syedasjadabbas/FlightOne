import { z } from "zod";

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"];

export const createWatchSchema = z.object({
  bookingId: z.string().trim().min(1, "bookingId is required"),
  flightNumber: z.string().trim().min(1).max(20).optional(),
  departAt: z.coerce.date().optional(),
  arriveAt: z.coerce.date().optional(),
});

export const listWatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const watchIdParamsSchema = z.object({
  id: z.string().min(1, "Watch id is required"),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const drainNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const listNotificationsQuerySchema = z.object({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const rebookHandoffSchema = z.object({
  supplierOfferSnapshotId: z.string().trim().min(1, "supplierOfferSnapshotId is required"),
});

export const escalateJourneySchema = z.object({
  conversationId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(1000).optional(),
});

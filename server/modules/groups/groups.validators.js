import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  GROUP_CABIN_PREFERENCES,
  GROUP_DATE_FLEXIBILITY,
  GROUP_MEMBER_ROLES,
  GROUP_TYPES,
  MAX_GROUP_PASSENGERS,
  MIN_GROUP_PASSENGERS,
} from "./groups.constants.js";

export {
  ATTENDANCE_STATUSES,
  GROUP_CABIN_PREFERENCES,
  GROUP_DATE_FLEXIBILITY,
  GROUP_MEMBER_ROLES,
  GROUP_MEMBER_STATUSES,
  GROUP_REQUEST_STATUSES,
  GROUP_TYPES,
  MAX_GROUP_PASSENGERS,
  MIN_GROUP_PASSENGERS,
  ORGANIZER_ROLES,
} from "./groups.constants.js";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(GROUP_TYPES),
  metadata: z.record(z.any()).optional(),
});

export const groupIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1).max(64),
});

export const addMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(GROUP_MEMBER_ROLES).default("MEMBER"),
});

export const inviteMemberSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(GROUP_MEMBER_ROLES).default("MEMBER"),
  })
  .refine((v) => Boolean(v.userId || v.email), {
    message: "userId or email is required",
  });

export const createAnnouncementSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  priority: z.number().int().min(0).max(10).optional(),
});

export const emergencySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const createPollSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(20),
  closesAt: z.coerce.date().optional(),
});

export const pollIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  pollId: z.string().trim().min(1),
});

export const voteSchema = z.object({
  optionIndex: z.number().int().min(0),
});

export const shareBookingSchema = z.object({
  bookingId: z.string().trim().min(1),
});

export const shareIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  shareId: z.string().trim().min(1),
});

export const shareDocumentSchema = z.object({
  vaultDocumentId: z.string().trim().min(1),
  label: z.string().trim().max(200).optional(),
});

export const waypointSchema = z.object({
  label: z.string().trim().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
});

export const waypointIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  waypointId: z.string().trim().min(1),
});

export const attendanceSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  status: z.enum(ATTENDANCE_STATUSES).default("PRESENT"),
  note: z.string().trim().max(500).optional(),
});

export const uploadPhotoSchema = z.object({
  contentBase64: z.string().min(1).max(20_000_000),
  contentType: z.string().trim().min(1),
  originalFilename: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(500).optional(),
});

export const photoIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  photoId: z.string().trim().min(1),
});

const placeCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2,10}$/.test(v), {
    message: "origin and destination must be 2–10 letters (IATA or city code)",
  });

const optionalDate = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  return v;
}, z.coerce.date().optional());

export const createGroupTravelRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(GROUP_TYPES),
    origin: placeCode,
    destination: placeCode,
    departureDate: optionalDate,
    returnDate: optionalDate,
    flexibility: z.enum(GROUP_DATE_FLEXIBILITY).default("EXACT"),
    passengerCount: z.coerce
      .number()
      .int()
      .min(MIN_GROUP_PASSENGERS, `Group travel requires at least ${MIN_GROUP_PASSENGERS} passengers`)
      .max(MAX_GROUP_PASSENGERS, `Passenger count cannot exceed ${MAX_GROUP_PASSENGERS}`),
    cabinPreference: z.enum(GROUP_CABIN_PREFERENCES).optional().nullable(),
    purpose: z.string().trim().max(200).optional().nullable(),
    contactName: z.string().trim().min(1).max(200),
    contactEmail: z.string().trim().email().max(320),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    organization: z.string().trim().max(200).optional().nullable(),
    baggageRequired: z.boolean().optional(),
    seatingTogether: z.boolean().optional(),
    airportTransfers: z.boolean().optional(),
    splitBilling: z.boolean().optional(),
    accommodationRequired: z.boolean().optional(),
    accommodationNotes: z.string().trim().max(1000).optional().nullable(),
    transportNotes: z.string().trim().max(1000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.origin === v.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "origin and destination must be different",
        path: ["destination"],
      });
    }
    if (v.returnDate && !v.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "departureDate is required when returnDate is set",
        path: ["departureDate"],
      });
    }
    if (v.departureDate && v.returnDate && v.returnDate < v.departureDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "returnDate cannot be before departureDate",
        path: ["returnDate"],
      });
    }
  });

export const updateGroupTravelRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    type: z.enum(GROUP_TYPES).optional(),
    origin: placeCode.optional(),
    destination: placeCode.optional(),
    departureDate: optionalDate,
    returnDate: optionalDate,
    flexibility: z.enum(GROUP_DATE_FLEXIBILITY).optional(),
    passengerCount: z.coerce
      .number()
      .int()
      .min(MIN_GROUP_PASSENGERS)
      .max(MAX_GROUP_PASSENGERS)
      .optional(),
    cabinPreference: z.enum(GROUP_CABIN_PREFERENCES).optional().nullable(),
    purpose: z.string().trim().max(200).optional().nullable(),
    contactName: z.string().trim().min(1).max(200).optional(),
    contactEmail: z.string().trim().email().max(320).optional(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    organization: z.string().trim().max(200).optional().nullable(),
    baggageRequired: z.boolean().optional(),
    seatingTogether: z.boolean().optional(),
    airportTransfers: z.boolean().optional(),
    splitBilling: z.boolean().optional(),
    accommodationRequired: z.boolean().optional(),
    accommodationNotes: z.string().trim().max(1000).optional().nullable(),
    transportNotes: z.string().trim().max(1000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const cancelGroupTravelRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const groupTravelRequestIdParamsSchema = z.object({
  requestId: z.string().trim().min(1),
});

import { z } from "zod";

export const MICE_EVENT_TYPES = ["MEETING", "INCENTIVE", "CONFERENCE", "EXHIBITION"];
export const MICE_BOOKING_KINDS = ["FLIGHT", "HOTEL", "TRANSFER", "OTHER"];
export const MICE_TRANSFER_DIRECTIONS = ["AIRPORT_PICKUP", "AIRPORT_DROPOFF"];

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(MICE_EVENT_TYPES),
    venue: z.string().trim().min(1).max(300).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    companyId: z.string().trim().min(1).optional(),
    budgetMinor: z.number().int().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .optional(),
    groupId: z.string().trim().min(1).optional(),
    autoCreateGroup: z.boolean().optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] })
  .refine((v) => !(v.groupId && v.autoCreateGroup), {
    message: "Provide either groupId or autoCreateGroup, not both",
    path: ["groupId"],
  });

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  venue: z.string().trim().max(300).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  budgetMinor: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).optional(),
  companyId: z.string().trim().min(1).nullable().optional(),
});

export const eventIdParamsSchema = z.object({ id: z.string().trim().min(1) });

export const delegateIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  delegateId: z.string().trim().min(1),
});

export const transferIdParamsSchema = z.object({
  id: z.string().trim().min(1),
  transferId: z.string().trim().min(1),
});

export const registerDelegateSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  dietary: z.string().trim().max(300).optional(),
});

export const selfRegisterSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  dietary: z.string().trim().max(300).optional(),
});

export const createSessionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    track: z.string().trim().max(120).optional(),
    speakers: z.string().trim().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });

export const checkInSchema = z.object({
  badgeCode: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).optional(),
});

export const linkBookingSchema = z.object({
  bookingId: z.string().trim().min(1),
  kind: z.enum(MICE_BOOKING_KINDS).optional(),
  delegateId: z.string().trim().min(1).optional(),
});

const airportCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(8)
  .transform((v) => v.toUpperCase())
  .optional();

export const transferSchema = z.object({
  label: z.string().trim().min(1).max(200),
  direction: z.enum(MICE_TRANSFER_DIRECTIONS).optional(),
  delegateId: z.string().trim().min(1).optional(),
  passengerCount: z.number().int().positive().max(50).optional(),
  airportCode: airportCodeSchema,
  flightRef: z.string().trim().max(40).optional(),
  flightBookingId: z.string().trim().min(1).optional(),
  pickupAt: z.coerce.date().optional(),
  pickupLocation: z.string().trim().max(300).optional(),
  dropoffLocation: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  bookingId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  /** When true (default), evaluate booking provider after create. */
  requestProviderBooking: z.boolean().optional(),
});

export const updateTransferSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  direction: z.enum(MICE_TRANSFER_DIRECTIONS).optional(),
  delegateId: z.string().trim().min(1).nullable().optional(),
  passengerCount: z.number().int().positive().max(50).optional(),
  airportCode: airportCodeSchema.nullable().optional(),
  flightRef: z.string().trim().max(40).nullable().optional(),
  flightBookingId: z.string().trim().min(1).nullable().optional(),
  pickupAt: z.coerce.date().nullable().optional(),
  pickupLocation: z.string().trim().max(300).nullable().optional(),
  dropoffLocation: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  bookingId: z.string().trim().min(1).nullable().optional(),
  requestProviderBooking: z.boolean().optional(),
});

export const budgetLineSchema = z.object({
  id: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  plannedMinor: z.number().int().nonnegative().optional(),
  actualMinor: z.number().int().nonnegative().optional(),
});

export const sponsorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  tier: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().email().optional(),
  deliverables: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(1000).optional(),
});

const optionalDate = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  return v;
}, z.coerce.date().optional());

const placeText = z.string().trim().min(2).max(80);

export const createMiceEnquirySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(MICE_EVENT_TYPES),
    organization: z.string().trim().max(200).optional().nullable(),
    destination: placeText,
    origin: z.string().trim().min(2).max(80).optional().nullable(),
    venue: z.string().trim().max(300).optional().nullable(),
    eventStartsAt: z.coerce.date(),
    eventEndsAt: z.coerce.date(),
    travelStartsAt: optionalDate,
    travelEndsAt: optionalDate,
    attendeeCount: z.coerce.number().int().min(1).max(5000),
    budgetMinor: z.number().int().nonnegative().optional().nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .optional()
      .nullable(),
    companyId: z.string().trim().min(1).optional().nullable(),
    contactName: z.string().trim().min(1).max(200),
    contactEmail: z.string().trim().email().max(320),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    flightsRequired: z.boolean().optional(),
    hotelsRequired: z.boolean().optional(),
    transfersRequired: z.boolean().optional(),
    meetingSpaceRequired: z.boolean().optional(),
    cateringRequired: z.boolean().optional(),
    visaAssistanceRequired: z.boolean().optional(),
    accommodationNotes: z.string().trim().max(1000).optional().nullable(),
    transportNotes: z.string().trim().max(1000).optional().nullable(),
    flightNotes: z.string().trim().max(1000).optional().nullable(),
    meetingNotes: z.string().trim().max(1000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .superRefine((v, ctx) => {
    if (!(v.eventEndsAt > v.eventStartsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "eventEndsAt must be after eventStartsAt",
        path: ["eventEndsAt"],
      });
    }
    if (v.travelStartsAt && v.travelEndsAt && v.travelEndsAt < v.travelStartsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "travelEndsAt cannot be before travelStartsAt",
        path: ["travelEndsAt"],
      });
    }
  });

export const updateMiceEnquirySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    organization: z.string().trim().max(200).optional().nullable(),
    destination: placeText.optional(),
    origin: z.string().trim().min(2).max(80).optional().nullable(),
    venue: z.string().trim().max(300).optional().nullable(),
    eventStartsAt: z.coerce.date().optional(),
    eventEndsAt: z.coerce.date().optional(),
    travelStartsAt: optionalDate,
    travelEndsAt: optionalDate,
    attendeeCount: z.coerce.number().int().min(1).max(5000).optional(),
    budgetMinor: z.number().int().nonnegative().optional().nullable(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase())
      .optional()
      .nullable(),
    contactName: z.string().trim().min(1).max(200).optional(),
    contactEmail: z.string().trim().email().max(320).optional(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    flightsRequired: z.boolean().optional(),
    hotelsRequired: z.boolean().optional(),
    transfersRequired: z.boolean().optional(),
    meetingSpaceRequired: z.boolean().optional(),
    cateringRequired: z.boolean().optional(),
    visaAssistanceRequired: z.boolean().optional(),
    accommodationNotes: z.string().trim().max(1000).optional().nullable(),
    transportNotes: z.string().trim().max(1000).optional().nullable(),
    flightNotes: z.string().trim().max(1000).optional().nullable(),
    meetingNotes: z.string().trim().max(1000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const cancelMiceEnquirySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const miceEnquiryIdParamsSchema = z.object({
  enquiryId: z.string().trim().min(1),
});

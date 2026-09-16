import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  GROUP_MEMBER_ROLES,
  GROUP_TYPES,
} from "./groups.constants.js";

export {
  ATTENDANCE_STATUSES,
  GROUP_MEMBER_ROLES,
  GROUP_MEMBER_STATUSES,
  GROUP_TYPES,
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

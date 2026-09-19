/**
 * Module 12 — MICE event enquiries (manual-assisted).
 * Reuses MiceEvent workspaces + NotificationOutbox. Never invents inventory.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyMiceUsers } from "./mice.notify.js";
import { createEvent } from "./mice.service.js";

const ENQUIRY_SELECT = {
  id: true,
  createdByUserId: true,
  eventId: true,
  companyId: true,
  name: true,
  type: true,
  status: true,
  organization: true,
  destination: true,
  origin: true,
  venue: true,
  eventStartsAt: true,
  eventEndsAt: true,
  travelStartsAt: true,
  travelEndsAt: true,
  attendeeCount: true,
  budgetMinor: true,
  currency: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  flightsRequired: true,
  hotelsRequired: true,
  transfersRequired: true,
  meetingSpaceRequired: true,
  cateringRequired: true,
  visaAssistanceRequired: true,
  accommodationNotes: true,
  transportNotes: true,
  flightNotes: true,
  meetingNotes: true,
  notes: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
};

function toPublic(row) {
  if (!row) return row;
  return {
    ...row,
    fulfilment: "MANUAL_ASSISTED",
    fulfilmentNote:
      "The MICE desk reviews this enquiry. FlightOne does not confirm venues, flights, hotels, fares, or tickets automatically.",
  };
}

async function getOwnedOrThrow(enquiryId, userId) {
  const row = await prisma.miceEventEnquiry.findUnique({
    where: { id: enquiryId },
    select: ENQUIRY_SELECT,
  });
  if (!row || row.createdByUserId !== userId) {
    throw new AppError(404, "MICE enquiry not found");
  }
  return row;
}

export async function createMiceEnquiry(userId, body) {
  if (!userId) throw new AppError(401, "Authentication required");
  const attendeeCount = Number(body.attendeeCount);
  if (!Number.isInteger(attendeeCount) || attendeeCount < 1 || attendeeCount > 5000) {
    throw new AppError(400, "attendeeCount must be between 1 and 5000");
  }
  const eventStartsAt = new Date(body.eventStartsAt);
  const eventEndsAt = new Date(body.eventEndsAt);
  if (Number.isNaN(eventStartsAt.getTime()) || Number.isNaN(eventEndsAt.getTime()) || !(eventEndsAt > eventStartsAt)) {
    throw new AppError(400, "eventEndsAt must be after eventStartsAt");
  }

  if (body.idempotencyKey) {
    const existing = await prisma.miceEventEnquiry.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      select: ENQUIRY_SELECT,
    });
    if (existing) {
      if (existing.createdByUserId !== userId) {
        throw new AppError(409, "Idempotency key already used");
      }
      return toPublic(existing);
    }
  }

  let created;
  try {
    created = await prisma.miceEventEnquiry.create({
      data: {
        createdByUserId: userId,
        companyId: body.companyId || null,
        name: body.name,
        type: body.type,
        status: "SUBMITTED",
        organization: body.organization || null,
        destination: body.destination,
        origin: body.origin || null,
        venue: body.venue || null,
        eventStartsAt: new Date(body.eventStartsAt),
        eventEndsAt: new Date(body.eventEndsAt),
        travelStartsAt: body.travelStartsAt ? new Date(body.travelStartsAt) : null,
        travelEndsAt: body.travelEndsAt ? new Date(body.travelEndsAt) : null,
        attendeeCount,
        budgetMinor: body.budgetMinor ?? null,
        currency: body.currency || null,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone || null,
        flightsRequired: Boolean(body.flightsRequired),
        hotelsRequired: Boolean(body.hotelsRequired),
        transfersRequired: Boolean(body.transfersRequired),
        meetingSpaceRequired: Boolean(body.meetingSpaceRequired),
        cateringRequired: Boolean(body.cateringRequired),
        visaAssistanceRequired: Boolean(body.visaAssistanceRequired),
        accommodationNotes: body.accommodationNotes || null,
        transportNotes: body.transportNotes || null,
        flightNotes: body.flightNotes || null,
        meetingNotes: body.meetingNotes || null,
        notes: body.notes || null,
        idempotencyKey: body.idempotencyKey || null,
      },
      select: ENQUIRY_SELECT,
    });
  } catch (e) {
    if (e.code === "P2002" && body.idempotencyKey) {
      const raced = await prisma.miceEventEnquiry.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        select: ENQUIRY_SELECT,
      });
      if (raced && raced.createdByUserId === userId) return toPublic(raced);
      throw new AppError(409, "Idempotency key already used");
    }
    throw e;
  }

  let event = null;
  try {
    event = await createEvent(userId, {
      name: body.name,
      type: body.type,
      venue: [body.venue, body.destination].filter(Boolean).join(" · ") || undefined,
      startsAt: new Date(body.eventStartsAt),
      endsAt: new Date(body.eventEndsAt),
      companyId: body.companyId || undefined,
      budgetMinor: body.budgetMinor ?? undefined,
      currency: body.currency || undefined,
      autoCreateGroup: true,
    });
    created = await prisma.miceEventEnquiry.update({
      where: { id: created.id },
      data: { eventId: event.id },
      select: ENQUIRY_SELECT,
    });
  } catch {
    event = null;
  }

  await writeAudit({
    userId,
    action: "mice.enquiry.create",
    resourceType: "MiceEventEnquiry",
    resourceId: created.id,
    metadata: { type: created.type, attendeeCount: created.attendeeCount, eventId: created.eventId },
  });

  await notifyMiceUsers({
    userIds: [userId],
    dedupeKeyPrefix: `mice-enquiry-submitted:${created.id}`,
    title: "MICE enquiry received",
    body: `Your enquiry for “${created.name}” (${created.attendeeCount} attendees) was submitted. The MICE desk will review it manually.`,
    payload: { enquiryId: created.id, status: created.status, kind: "mice_enquiry" },
  });

  return toPublic({ ...created, event });
}

export async function listMyMiceEnquiries(userId) {
  if (!userId) throw new AppError(401, "Authentication required");
  const items = await prisma.miceEventEnquiry.findMany({
    where: { createdByUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: ENQUIRY_SELECT,
  });
  return { items: items.map(toPublic) };
}

export async function getMiceEnquiry(userId, enquiryId) {
  return toPublic(await getOwnedOrThrow(enquiryId, userId));
}

export async function updateMiceEnquiry(userId, enquiryId, body) {
  const row = await getOwnedOrThrow(enquiryId, userId);
  if (row.status !== "SUBMITTED") {
    throw new AppError(409, `Cannot edit an enquiry in status ${row.status}`);
  }

  const nextStart = body.eventStartsAt ? new Date(body.eventStartsAt) : row.eventStartsAt;
  const nextEnd = body.eventEndsAt ? new Date(body.eventEndsAt) : row.eventEndsAt;
  if (!(nextEnd > nextStart)) {
    throw new AppError(400, "eventEndsAt must be after eventStartsAt");
  }

  const data = {};
  const assignable = [
    "name",
    "organization",
    "destination",
    "origin",
    "venue",
    "attendeeCount",
    "budgetMinor",
    "currency",
    "contactName",
    "contactEmail",
    "contactPhone",
    "flightsRequired",
    "hotelsRequired",
    "transfersRequired",
    "meetingSpaceRequired",
    "cateringRequired",
    "visaAssistanceRequired",
    "accommodationNotes",
    "transportNotes",
    "flightNotes",
    "meetingNotes",
    "notes",
  ];
  for (const key of assignable) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.eventStartsAt !== undefined) data.eventStartsAt = new Date(body.eventStartsAt);
  if (body.eventEndsAt !== undefined) data.eventEndsAt = new Date(body.eventEndsAt);
  if (body.travelStartsAt !== undefined) {
    data.travelStartsAt = body.travelStartsAt ? new Date(body.travelStartsAt) : null;
  }
  if (body.travelEndsAt !== undefined) {
    data.travelEndsAt = body.travelEndsAt ? new Date(body.travelEndsAt) : null;
  }

  const updated = await prisma.miceEventEnquiry.update({
    where: { id: enquiryId },
    data,
    select: ENQUIRY_SELECT,
  });

  await writeAudit({
    userId,
    action: "mice.enquiry.update",
    resourceType: "MiceEventEnquiry",
    resourceId: enquiryId,
    metadata: { fields: Object.keys(data) },
  });

  return toPublic(updated);
}

export async function cancelMiceEnquiry(userId, enquiryId, { reason } = {}) {
  const row = await getOwnedOrThrow(enquiryId, userId);
  if (row.status === "CANCELLED") return toPublic(row);
  if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
    throw new AppError(409, `Cannot cancel an enquiry in status ${row.status}`);
  }

  const updated = await prisma.miceEventEnquiry.update({
    where: { id: enquiryId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason || null,
    },
    select: ENQUIRY_SELECT,
  });

  await writeAudit({
    userId,
    action: "mice.enquiry.cancel",
    resourceType: "MiceEventEnquiry",
    resourceId: enquiryId,
    metadata: { reason: reason || null },
  });

  await notifyMiceUsers({
    userIds: [userId],
    dedupeKeyPrefix: `mice-enquiry-cancelled:${enquiryId}`,
    title: "MICE enquiry cancelled",
    body: `Your MICE enquiry “${updated.name}” was cancelled.`,
    payload: { enquiryId, status: "CANCELLED", kind: "mice_enquiry" },
  });

  return toPublic(updated);
}

/**
 * Module 11 — Group Travel booking requests (manual-assisted enquiry).
 * Reuses TravelGroup workspaces + NotificationOutbox. Never invents fares,
 * PNRs, tickets, or automated group ticketing.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { createGroup } from "./groups.service.js";
import { MIN_GROUP_PASSENGERS, MAX_GROUP_PASSENGERS } from "./groups.constants.js";

const REQUEST_SELECT = {
  id: true,
  createdByUserId: true,
  groupId: true,
  name: true,
  type: true,
  status: true,
  origin: true,
  destination: true,
  departureDate: true,
  returnDate: true,
  flexibility: true,
  passengerCount: true,
  cabinPreference: true,
  purpose: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  organization: true,
  baggageRequired: true,
  seatingTogether: true,
  airportTransfers: true,
  splitBilling: true,
  accommodationRequired: true,
  accommodationNotes: true,
  transportNotes: true,
  notes: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
};

const NOTIFY_CHANNELS = ["APP", "EMAIL", "WHATSAPP"];

function toPublic(row) {
  if (!row) return row;
  return {
    ...row,
    fulfilment: "MANUAL_ASSISTED",
    fulfilmentNote:
      "Group desk reviews this request. FlightOne does not issue group tickets or confirm airline inventory automatically.",
    minPassengerCount: MIN_GROUP_PASSENGERS,
  };
}

function assertPassengerCount(count) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < MIN_GROUP_PASSENGERS || n > MAX_GROUP_PASSENGERS) {
    throw new AppError(
      400,
      `Group travel requires between ${MIN_GROUP_PASSENGERS} and ${MAX_GROUP_PASSENGERS} passengers`,
    );
  }
  return n;
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new AppError(400, "Invalid date");
    return value;
  }
  const raw = String(value).trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const parsed = isoDay
    ? new Date(`${isoDay[1]}-${isoDay[2]}-${isoDay[3]}T00:00:00.000Z`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, "Invalid date");
  return parsed;
}

async function notifyOwner(userId, { dedupeKey, title, body, payload }) {
  await enqueueNotificationOutbox(
    NOTIFY_CHANNELS.map((channel) => ({
      userId,
      channel,
      dedupeKey: `${dedupeKey}:${channel}`,
      title,
      body,
      payload: { module: "groups", kind: "group_travel_request", ...payload },
    })),
  );
}

async function getOwnedRequestOrThrow(requestId, userId) {
  const row = await prisma.groupTravelRequest.findUnique({
    where: { id: requestId },
    select: REQUEST_SELECT,
  });
  if (!row || row.createdByUserId !== userId) {
    throw new AppError(404, "Group travel request not found");
  }
  return row;
}

export async function createGroupTravelRequest(userId, body) {
  if (!userId) throw new AppError(401, "Authentication required");
  assertPassengerCount(body.passengerCount);

  if (body.idempotencyKey) {
    const existing = await prisma.groupTravelRequest.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      select: REQUEST_SELECT,
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
    created = await prisma.groupTravelRequest.create({
      data: {
        createdByUserId: userId,
        name: body.name,
        type: body.type,
        status: "SUBMITTED",
        origin: body.origin,
        destination: body.destination,
        departureDate: parseOptionalDate(body.departureDate),
        returnDate: parseOptionalDate(body.returnDate),
        flexibility: body.flexibility || "EXACT",
        passengerCount: body.passengerCount,
        cabinPreference: body.cabinPreference || null,
        purpose: body.purpose || null,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone || null,
        organization: body.organization || null,
        baggageRequired: Boolean(body.baggageRequired),
        seatingTogether: Boolean(body.seatingTogether),
        airportTransfers: Boolean(body.airportTransfers),
        splitBilling: Boolean(body.splitBilling),
        accommodationRequired: Boolean(body.accommodationRequired),
        accommodationNotes: body.accommodationNotes || null,
        transportNotes: body.transportNotes || null,
        notes: body.notes || null,
        idempotencyKey: body.idempotencyKey || null,
      },
      select: REQUEST_SELECT,
    });
  } catch (e) {
    if (e.code === "P2002" && body.idempotencyKey) {
      const raced = await prisma.groupTravelRequest.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        select: REQUEST_SELECT,
      });
      if (raced && raced.createdByUserId === userId) return toPublic(raced);
      throw new AppError(409, "Idempotency key already used");
    }
    throw e;
  }

  let group = null;
  try {
    group = await createGroup(userId, {
      name: body.name,
      type: body.type,
      metadata: {
        source: "GROUP_TRAVEL_REQUEST",
        requestId: created.id,
        passengerCount: created.passengerCount,
        origin: created.origin,
        destination: created.destination,
      },
    });
    created = await prisma.groupTravelRequest.update({
      where: { id: created.id },
      data: { groupId: group.id },
      select: REQUEST_SELECT,
    });
  } catch {
    group = null;
  }

  await writeAudit({
    userId,
    action: "groups.request.create",
    resourceType: "GroupTravelRequest",
    resourceId: created.id,
    metadata: {
      origin: created.origin,
      destination: created.destination,
      passengerCount: created.passengerCount,
      groupId: created.groupId,
    },
  });

  await notifyOwner(userId, {
    dedupeKey: `group-request-submitted:${created.id}`,
    title: "Group travel request received",
    body: `Your request for ${created.passengerCount} travellers (${created.origin} → ${created.destination}) was submitted. The group desk will review it manually.`,
    payload: { requestId: created.id, status: created.status },
  });

  return toPublic({ ...created, group });
}

export async function listMyGroupTravelRequests(userId) {
  if (!userId) throw new AppError(401, "Authentication required");
  const items = await prisma.groupTravelRequest.findMany({
    where: { createdByUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: REQUEST_SELECT,
  });
  return { items: items.map(toPublic), minPassengerCount: MIN_GROUP_PASSENGERS };
}

export async function getGroupTravelRequest(userId, requestId) {
  const row = await getOwnedRequestOrThrow(requestId, userId);
  return toPublic(row);
}

export async function updateGroupTravelRequest(userId, requestId, body) {
  const row = await getOwnedRequestOrThrow(requestId, userId);
  if (row.status !== "SUBMITTED") {
    throw new AppError(409, `Cannot edit a request in status ${row.status}`);
  }
  if (body.passengerCount !== undefined) {
    assertPassengerCount(body.passengerCount);
  }

  const nextOrigin = body.origin ?? row.origin;
  const nextDestination = body.destination ?? row.destination;
  if (nextOrigin === nextDestination) {
    throw new AppError(400, "origin and destination must be different");
  }

  const nextDeparture =
    body.departureDate === undefined ? row.departureDate : parseOptionalDate(body.departureDate);
  const nextReturn =
    body.returnDate === undefined ? row.returnDate : parseOptionalDate(body.returnDate);
  if (nextReturn && !nextDeparture) {
    throw new AppError(400, "departureDate is required when returnDate is set");
  }
  if (nextDeparture && nextReturn && new Date(nextReturn) < new Date(nextDeparture)) {
    throw new AppError(400, "returnDate cannot be before departureDate");
  }

  const data = {};
  const assignable = [
    "name",
    "type",
    "origin",
    "destination",
    "flexibility",
    "passengerCount",
    "cabinPreference",
    "purpose",
    "contactName",
    "contactEmail",
    "contactPhone",
    "organization",
    "baggageRequired",
    "seatingTogether",
    "airportTransfers",
    "splitBilling",
    "accommodationRequired",
    "accommodationNotes",
    "transportNotes",
    "notes",
  ];
  for (const key of assignable) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.departureDate !== undefined) data.departureDate = parseOptionalDate(body.departureDate);
  if (body.returnDate !== undefined) data.returnDate = parseOptionalDate(body.returnDate);

  const updated = await prisma.groupTravelRequest.update({
    where: { id: requestId },
    data,
    select: REQUEST_SELECT,
  });

  await writeAudit({
    userId,
    action: "groups.request.update",
    resourceType: "GroupTravelRequest",
    resourceId: requestId,
    metadata: { fields: Object.keys(data) },
  });

  return toPublic(updated);
}

export async function cancelGroupTravelRequest(userId, requestId, { reason } = {}) {
  const row = await getOwnedRequestOrThrow(requestId, userId);
  if (row.status === "CANCELLED") {
    return toPublic(row);
  }
  if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") {
    throw new AppError(409, `Cannot cancel a request in status ${row.status}`);
  }

  const updated = await prisma.groupTravelRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason || null,
    },
    select: REQUEST_SELECT,
  });

  await writeAudit({
    userId,
    action: "groups.request.cancel",
    resourceType: "GroupTravelRequest",
    resourceId: requestId,
    metadata: { reason: reason || null },
  });

  await notifyOwner(userId, {
    dedupeKey: `group-request-cancelled:${requestId}`,
    title: "Group travel request cancelled",
    body: `Your group request ${updated.name} was cancelled.`,
    payload: { requestId, status: "CANCELLED" },
  });

  return toPublic(updated);
}

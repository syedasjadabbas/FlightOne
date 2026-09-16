/**
 * Module 12 — MICE Platform (complete Phase 2 slice).
 * Extension over Module 11 group primitives — never a parallel booking system.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { randomToken } from "../../lib/crypto.js";
import { writeAudit } from "../../lib/audit.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { assertNonNegativeMinorAmount } from "../../lib/money.js";
import { buildSimplePdf } from "../vault/vault.printables.js";
import * as groupsService from "../groups/groups.service.js";
import { notifyMiceUsers } from "./mice.notify.js";
import {
  attemptMiceTransferBooking,
  fetchMiceTransferLiveStatus,
  getMiceTransferCapability,
} from "./mice.transferProvider.js";

function isPlatformOverride(perms) {
  return Boolean(perms && hasPermissionEff(perms, "mice:write"));
}

const EVENT_SELECT = {
  id: true,
  groupId: true,
  name: true,
  type: true,
  venue: true,
  startsAt: true,
  endsAt: true,
  companyId: true,
  budgetMinor: true,
  currency: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
};

const DELEGATE_SELECT = {
  id: true,
  eventId: true,
  userId: true,
  fullName: true,
  email: true,
  registrationStatus: true,
  badgeCode: true,
  dietary: true,
  createdAt: true,
};

const SESSION_SELECT = {
  id: true,
  eventId: true,
  title: true,
  track: true,
  speakers: true,
  startsAt: true,
  endsAt: true,
  location: true,
  createdAt: true,
};

const CHECKIN_SELECT = {
  id: true,
  eventId: true,
  sessionId: true,
  delegateId: true,
  checkedInAt: true,
  method: true,
};

const BOOKING_SHARE_SELECT = {
  id: true,
  eventId: true,
  bookingId: true,
  delegateId: true,
  sharedByUserId: true,
  kind: true,
  createdAt: true,
};

const TRANSFER_SELECT = {
  id: true,
  eventId: true,
  delegateId: true,
  label: true,
  direction: true,
  passengerCount: true,
  airportCode: true,
  flightRef: true,
  flightBookingId: true,
  pickupAt: true,
  pickupLocation: true,
  dropoffLocation: true,
  notes: true,
  bookingId: true,
  status: true,
  providerStatus: true,
  providerReason: true,
  transferRef: true,
  confirmedAt: true,
  idempotencyKey: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
};

const BUDGET_LINE_SELECT = {
  id: true,
  eventId: true,
  category: true,
  label: true,
  plannedMinor: true,
  actualMinor: true,
  createdAt: true,
  updatedAt: true,
};

const SPONSOR_SELECT = {
  id: true,
  eventId: true,
  name: true,
  tier: true,
  contactEmail: true,
  deliverables: true,
  note: true,
  createdAt: true,
  updatedAt: true,
};

async function getEventOrThrow(eventId, select = EVENT_SELECT) {
  const event = await prisma.miceEvent.findUnique({ where: { id: eventId }, select });
  if (!event) throw new AppError(404, "Event not found");
  return event;
}

async function isGroupOrganizer(groupId, userId) {
  if (!groupId) return false;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });
  return Boolean(
    membership && membership.status === "ACTIVE" && ["ORGANIZER", "ADMIN"].includes(membership.role),
  );
}

async function isGroupMember(groupId, userId) {
  if (!groupId) return false;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { status: true },
  });
  return Boolean(membership && membership.status === "ACTIVE");
}

async function isRegisteredDelegate(eventId, userId) {
  if (!userId) return false;
  const d = await prisma.miceDelegate.findFirst({
    where: { eventId, userId, registrationStatus: { not: "CANCELLED" } },
    select: { id: true },
  });
  return Boolean(d);
}

async function assertEventManager(event, userId, perms) {
  if (event.createdByUserId === userId) return;
  if (isPlatformOverride(perms)) return;
  if (await isGroupOrganizer(event.groupId, userId)) return;
  throw new AppError(403, "Only the event creator or an organizer can do this");
}

async function assertEventReadAccess(event, userId, perms) {
  if (event.createdByUserId === userId) return;
  if (isPlatformOverride(perms)) return;
  if (await isGroupMember(event.groupId, userId)) return;
  if (await isRegisteredDelegate(event.id, userId)) return;
  throw new AppError(403, "Not authorized to view this event");
}

function generateBadgeCode() {
  return `MICE-${randomToken(5).toUpperCase()}`;
}

async function createDelegateWithUniqueBadge(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.miceDelegate.create({
        data: { ...data, badgeCode: generateBadgeCode() },
        select: DELEGATE_SELECT,
      });
    } catch (e) {
      if (e.code === "P2002" && e.meta?.target?.includes?.("badgeCode")) continue;
      if (e.code === "P2002" && e.meta?.target?.includes?.("eventId_email")) {
        throw new AppError(409, "A delegate with this email is already registered");
      }
      throw e;
    }
  }
  throw new AppError(500, "Could not generate a unique badge code, try again");
}

export async function createEvent(creatorUserId, body) {
  const {
    name,
    type,
    venue,
    startsAt,
    endsAt,
    companyId,
    budgetMinor,
    currency,
    groupId,
    autoCreateGroup,
  } = body;
  if (budgetMinor !== undefined && budgetMinor !== null) {
    assertNonNegativeMinorAmount(budgetMinor, "budgetMinor");
  }

  let resolvedGroupId = groupId ?? null;
  if (resolvedGroupId) {
    const group = await prisma.travelGroup.findUnique({
      where: { id: resolvedGroupId },
      select: { id: true },
    });
    if (!group) throw new AppError(404, "Linked group not found");
  } else if (autoCreateGroup) {
    const group = await groupsService.createGroup(creatorUserId, { name, type: "OTHER" });
    resolvedGroupId = group.id;
  }

  const event = await prisma.miceEvent.create({
    data: {
      groupId: resolvedGroupId,
      name,
      type,
      venue: venue ?? null,
      startsAt,
      endsAt,
      companyId: companyId ?? null,
      budgetMinor: budgetMinor ?? null,
      currency: currency ?? null,
      createdByUserId: creatorUserId,
    },
    select: EVENT_SELECT,
  });
  await writeAudit({
    userId: creatorUserId,
    action: "mice.event_create",
    resourceType: "MiceEvent",
    resourceId: event.id,
    metadata: { type: event.type },
  });
  return event;
}

export async function listEvents(userId, perms) {
  if (isPlatformOverride(perms)) {
    return prisma.miceEvent.findMany({ orderBy: { startsAt: "desc" }, select: EVENT_SELECT });
  }
  const memberships = await prisma.groupMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  const asDelegate = await prisma.miceDelegate.findMany({
    where: { userId, registrationStatus: { not: "CANCELLED" } },
    select: { eventId: true },
  });
  const or = [{ createdByUserId: userId }];
  if (groupIds.length) or.push({ groupId: { in: groupIds } });
  if (asDelegate.length) or.push({ id: { in: asDelegate.map((d) => d.eventId) } });

  return prisma.miceEvent.findMany({
    where: { OR: or },
    orderBy: { startsAt: "desc" },
    select: EVENT_SELECT,
  });
}

export async function getEvent(eventId, userId, perms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, userId, perms);
  const isManager =
    event.createdByUserId === userId ||
    isPlatformOverride(perms) ||
    (await isGroupOrganizer(event.groupId, userId));
  return { ...event, myRole: isManager ? "MANAGER" : "DELEGATE" };
}

export async function updateEvent(eventId, userId, perms, patch) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, userId, perms);
  if (patch.budgetMinor != null) assertNonNegativeMinorAmount(patch.budgetMinor, "budgetMinor");
  if (patch.startsAt && patch.endsAt && new Date(patch.endsAt) <= new Date(patch.startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  return prisma.miceEvent.update({
    where: { id: eventId },
    data: {
      name: patch.name ?? undefined,
      venue: patch.venue !== undefined ? patch.venue : undefined,
      startsAt: patch.startsAt ?? undefined,
      endsAt: patch.endsAt ?? undefined,
      budgetMinor: patch.budgetMinor !== undefined ? patch.budgetMinor : undefined,
      currency: patch.currency ?? undefined,
      companyId: patch.companyId !== undefined ? patch.companyId : undefined,
    },
    select: EVENT_SELECT,
  });
}

export async function registerDelegate(eventId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  const email = String(body.email).trim().toLowerCase();
  const existing = await prisma.miceDelegate.findFirst({
    where: { eventId, email },
    select: { id: true },
  });
  if (existing) throw new AppError(409, "A delegate with this email is already registered");

  const delegate = await createDelegateWithUniqueBadge({
    eventId,
    userId: body.userId ?? null,
    fullName: body.fullName,
    email,
    registrationStatus: "REGISTERED",
    dietary: body.dietary ?? null,
  });
  if (delegate.userId) {
    await notifyMiceUsers({
      userIds: [delegate.userId],
      dedupeKeyPrefix: `mice-register:${delegate.id}`,
      title: "Event registration",
      body: `You are registered for “${event.name}”.`,
      payload: { kind: "register", eventId, delegateId: delegate.id },
    });
  }
  await writeAudit({
    userId: actorUserId,
    action: "mice.delegate_register",
    resourceType: "MiceEvent",
    resourceId: eventId,
    metadata: { delegateId: delegate.id },
  });
  return delegate;
}

/** Authenticated self-registration as a delegate. */
export async function selfRegister(eventId, userId, { fullName, email, dietary } = {}) {
  const event = await getEventOrThrow(eventId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new AppError(401, "Unauthorized");

  const existingUser = await prisma.miceDelegate.findFirst({
    where: { eventId, userId },
    select: DELEGATE_SELECT,
  });
  if (existingUser && existingUser.registrationStatus !== "CANCELLED") {
    return existingUser;
  }

  const resolvedEmail = String(email || user.email).trim().toLowerCase();
  const existingEmail = await prisma.miceDelegate.findFirst({
    where: { eventId, email: resolvedEmail },
    select: { id: true, userId: true, registrationStatus: true },
  });
  if (existingEmail && existingEmail.registrationStatus !== "CANCELLED") {
    throw new AppError(409, "Already registered for this event");
  }

  return createDelegateWithUniqueBadge({
    eventId,
    userId,
    fullName: fullName || user.name || resolvedEmail,
    email: resolvedEmail,
    registrationStatus: "REGISTERED",
    dietary: dietary ?? null,
  });
}

export async function listDelegates(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const isManager =
    event.createdByUserId === actorUserId ||
    isPlatformOverride(actorPerms) ||
    (await isGroupOrganizer(event.groupId, actorUserId));
  const rows = await prisma.miceDelegate.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: DELEGATE_SELECT,
  });
  if (isManager) return rows;
  // Non-managers only see their own row details fully; others redacted.
  return rows.map((d) =>
    d.userId === actorUserId
      ? d
      : {
          id: d.id,
          eventId: d.eventId,
          userId: null,
          fullName: d.fullName,
          email: null,
          registrationStatus: d.registrationStatus,
          badgeCode: null,
          dietary: null,
          createdAt: d.createdAt,
        },
  );
}

export async function createSession(eventId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  return prisma.miceSession.create({
    data: {
      eventId,
      title: body.title,
      track: body.track ?? null,
      speakers: body.speakers ?? null,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      location: body.location ?? null,
    },
    select: SESSION_SELECT,
  });
}

export async function listSessions(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  return prisma.miceSession.findMany({
    where: { eventId },
    orderBy: { startsAt: "asc" },
    select: SESSION_SELECT,
  });
}

export async function checkIn(eventId, actorUserId, actorPerms, { badgeCode, sessionId }) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);

  const delegate = await prisma.miceDelegate.findFirst({
    where: { eventId, badgeCode: String(badgeCode).trim() },
    select: { id: true, registrationStatus: true, userId: true, fullName: true },
  });
  if (!delegate) throw new AppError(404, "Badge code not recognized for this event");
  if (delegate.registrationStatus === "CANCELLED") {
    throw new AppError(409, "This delegate's registration is cancelled");
  }

  let resolvedSessionId = "";
  if (sessionId) {
    const session = await prisma.miceSession.findFirst({
      where: { id: sessionId, eventId },
      select: { id: true },
    });
    if (!session) throw new AppError(404, "Session not found for this event");
    resolvedSessionId = sessionId;
  }

  const [checkInRow] = await prisma.$transaction([
    prisma.miceCheckIn.upsert({
      where: {
        delegateId_eventId_sessionId: {
          delegateId: delegate.id,
          eventId,
          sessionId: resolvedSessionId,
        },
      },
      update: {},
      create: { eventId, sessionId: resolvedSessionId, delegateId: delegate.id, method: "QR" },
      select: CHECKIN_SELECT,
    }),
    prisma.miceDelegate.update({
      where: { id: delegate.id },
      data: { registrationStatus: "CHECKED_IN" },
      select: { id: true },
    }),
  ]);

  await writeAudit({
    userId: actorUserId,
    action: "mice.check_in",
    resourceType: "MiceEvent",
    resourceId: eventId,
    metadata: { delegateId: delegate.id, sessionId: resolvedSessionId || null },
  });
  if (delegate.userId) {
    await notifyMiceUsers({
      userIds: [delegate.userId],
      dedupeKeyPrefix: `mice-checkin:${checkInRow.id}`,
      title: "Checked in",
      body: `Checked in to “${event.name}”.`,
      payload: { kind: "check_in", eventId, checkInId: checkInRow.id },
      channels: ["APP"],
    });
  }
  return checkInRow;
}

export async function getAttendance(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const isManager =
    event.createdByUserId === actorUserId ||
    isPlatformOverride(actorPerms) ||
    (await isGroupOrganizer(event.groupId, actorUserId));

  const [totalDelegates, byStatus, bySession, myDelegate] = await Promise.all([
    prisma.miceDelegate.count({ where: { eventId } }),
    prisma.miceDelegate.groupBy({
      by: ["registrationStatus"],
      where: { eventId },
      _count: { _all: true },
    }),
    prisma.miceCheckIn.groupBy({
      by: ["sessionId"],
      where: { eventId },
      _count: { _all: true },
    }),
    prisma.miceDelegate.findFirst({
      where: { eventId, userId: actorUserId },
      select: DELEGATE_SELECT,
    }),
  ]);

  return {
    eventId,
    totalDelegates,
    byRegistrationStatus: Object.fromEntries(
      byStatus.map((row) => [row.registrationStatus, row._count._all]),
    ),
    checkInsBySession: bySession.map((row) => ({
      sessionId: row.sessionId === "" ? null : row.sessionId,
      count: row._count._all,
    })),
    scope: isManager ? "event" : "self",
    myDelegate: myDelegate || null,
  };
}

/** Badge PDF — badgeCode is the QR payload (no private PII in QR beyond code). */
export async function getDelegateBadge(eventId, delegateId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const delegate = await prisma.miceDelegate.findFirst({
    where: { id: delegateId, eventId },
    select: DELEGATE_SELECT,
  });
  if (!delegate) throw new AppError(404, "Delegate not found");

  const isManager =
    event.createdByUserId === actorUserId ||
    isPlatformOverride(actorPerms) ||
    (await isGroupOrganizer(event.groupId, actorUserId));
  if (!isManager && delegate.userId !== actorUserId) {
    throw new AppError(403, "Not authorized to view this badge");
  }

  const pdf = buildSimplePdf({
    title: `${event.name} — Badge`,
    lines: [
      `Delegate: ${delegate.fullName}`,
      `Event: ${event.name}`,
      `Type: ${event.type}`,
      event.venue ? `Venue: ${event.venue}` : null,
      `Status: ${delegate.registrationStatus}`,
      `Check-in code: ${delegate.badgeCode}`,
      "(Present this code / QR for check-in)",
    ].filter(Boolean),
  });

  return {
    delegateId: delegate.id,
    badgeCode: delegate.badgeCode,
    fullName: delegate.fullName,
    eventName: event.name,
    contentType: "application/pdf",
    contentBase64: pdf.toString("base64"),
  };
}

export async function linkBooking(eventId, actorUserId, actorPerms, { bookingId, kind, delegateId }) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    select: { id: true, userId: true, product: true, status: true, amountMinor: true, currency: true },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  // Manager may link any booking they can see via ownership OR they own it
  if (booking.userId !== actorUserId && event.createdByUserId !== actorUserId && !isPlatformOverride(actorPerms)) {
    // Allow if booking owner is a registered delegate of this event
    const ownerDelegate = await prisma.miceDelegate.findFirst({
      where: { eventId, userId: booking.userId, registrationStatus: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (!ownerDelegate) {
      throw new AppError(403, "Booking must belong to you or a registered delegate");
    }
  }
  if (delegateId) {
    const d = await prisma.miceDelegate.findFirst({ where: { id: delegateId, eventId } });
    if (!d) throw new AppError(404, "Delegate not found for this event");
  }
  const resolvedKind =
    kind ||
    (booking.product === "FLIGHT" ? "FLIGHT" : booking.product === "HOTEL" ? "HOTEL" : "OTHER");

  try {
    return await prisma.miceBookingShare.create({
      data: {
        eventId,
        bookingId,
        delegateId: delegateId || null,
        sharedByUserId: actorUserId,
        kind: resolvedKind,
      },
    });
  } catch (e) {
    if (e.code === "P2002") throw new AppError(409, "Booking already linked to this event");
    throw e;
  }
}

export async function listLinkedTravel(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const shares = await prisma.miceBookingShare.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: BOOKING_SHARE_SELECT,
  });
  if (!shares.length) return { items: [] };
  const bookings = await prisma.booking.findMany({
    where: { id: { in: shares.map((s) => s.bookingId) } },
    select: {
      id: true,
      userId: true,
      status: true,
      product: true,
      currency: true,
      amountMinor: true,
      externalRef: true,
      metadata: true,
      updatedAt: true,
    },
  });
  const map = new Map(bookings.map((b) => [b.id, b]));
  return {
    items: shares
      .map((s) => {
        const b = map.get(s.bookingId);
        if (!b) return null;
        return {
          shareId: s.id,
          kind: s.kind,
          delegateId: s.delegateId,
          booking: {
            id: b.id,
            status: b.status,
            product: b.product,
            currency: b.currency,
            amountMinor: b.amountMinor,
            externalRef: b.externalRef,
          },
        };
      })
      .filter(Boolean),
  };
}

export async function createTransfer(eventId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);

  if (body.idempotencyKey) {
    const existing = await prisma.miceTransfer.findUnique({
      where: {
        eventId_idempotencyKey: { eventId, idempotencyKey: body.idempotencyKey },
      },
      select: TRANSFER_SELECT,
    });
    if (existing) {
      return enrichTransfer(existing, { capability: getMiceTransferCapability() });
    }
  }

  await assertDelegateOnEvent(eventId, body.delegateId);
  const flightBookingId = await resolveFlightBookingLink(eventId, actorUserId, actorPerms, body.flightBookingId);
  if (body.bookingId) {
    await assertBookingLinkable(eventId, actorUserId, actorPerms, body.bookingId);
  }

  const direction = body.direction || "AIRPORT_PICKUP";
  const passengerCount = body.passengerCount && body.passengerCount > 0 ? body.passengerCount : 1;

  let row;
  try {
    row = await prisma.miceTransfer.create({
      data: {
        eventId,
        delegateId: body.delegateId || null,
        label: body.label,
        direction,
        passengerCount,
        airportCode: body.airportCode || null,
        flightRef: body.flightRef || null,
        flightBookingId,
        pickupAt: body.pickupAt ? new Date(body.pickupAt) : null,
        pickupLocation: body.pickupLocation || null,
        dropoffLocation: body.dropoffLocation || null,
        notes: body.notes || null,
        bookingId: body.bookingId || null,
        status: "REQUESTED",
        idempotencyKey: body.idempotencyKey || null,
        createdByUserId: actorUserId,
      },
      select: TRANSFER_SELECT,
    });
  } catch (e) {
    if (e.code === "P2002" && body.idempotencyKey) {
      const raced = await prisma.miceTransfer.findUnique({
        where: {
          eventId_idempotencyKey: { eventId, idempotencyKey: body.idempotencyKey },
        },
        select: TRANSFER_SELECT,
      });
      if (raced) return enrichTransfer(raced, { capability: getMiceTransferCapability() });
    }
    throw e;
  }

  const shouldBook = body.requestProviderBooking !== false;
  if (shouldBook) {
    row = await applyTransferProviderBooking(row);
  }

  await writeAudit({
    userId: actorUserId,
    action: "mice.transfer_created",
    resourceType: "MiceTransfer",
    resourceId: row.id,
    metadata: {
      eventId,
      status: row.status,
      direction: row.direction,
      transferRef: row.transferRef,
    },
  }).catch(() => {});

  await notifyMiceUsers({
    userIds: [actorUserId, event.createdByUserId].filter(Boolean),
    title: `Transfer requirement: ${row.label}`,
    body: `Status ${row.status}${row.providerReason ? ` — ${row.providerReason}` : ""}`,
    dedupeKeyPrefix: `mice-transfer:${row.id}:${row.status}`,
    payload: { eventId, transferId: row.id, status: row.status },
  }).catch(() => {});

  return enrichTransfer(row, { capability: getMiceTransferCapability() });
}

export async function updateTransfer(eventId, transferId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  const existing = await prisma.miceTransfer.findFirst({
    where: { id: transferId, eventId },
    select: TRANSFER_SELECT,
  });
  if (!existing) throw new AppError(404, "Transfer not found");
  if (existing.status === "CONFIRMED" && existing.transferRef) {
    // Allow notes/location tweaks but never silently clear confirmation.
    if (body.requestProviderBooking) {
      throw new AppError(409, "Transfer already CONFIRMED — do not re-book");
    }
  }

  if (body.delegateId !== undefined && body.delegateId !== null) {
    await assertDelegateOnEvent(eventId, body.delegateId);
  }
  let flightBookingId = existing.flightBookingId;
  if (body.flightBookingId !== undefined) {
    flightBookingId =
      body.flightBookingId === null
        ? null
        : await resolveFlightBookingLink(eventId, actorUserId, actorPerms, body.flightBookingId);
  }
  if (body.bookingId) {
    await assertBookingLinkable(eventId, actorUserId, actorPerms, body.bookingId);
  }

  let row = await prisma.miceTransfer.update({
    where: { id: transferId },
    data: {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.direction !== undefined ? { direction: body.direction } : {}),
      ...(body.passengerCount !== undefined ? { passengerCount: body.passengerCount } : {}),
      ...(body.airportCode !== undefined ? { airportCode: body.airportCode } : {}),
      ...(body.flightRef !== undefined ? { flightRef: body.flightRef } : {}),
      ...(body.flightBookingId !== undefined ? { flightBookingId } : {}),
      ...(body.pickupAt !== undefined
        ? { pickupAt: body.pickupAt ? new Date(body.pickupAt) : null }
        : {}),
      ...(body.pickupLocation !== undefined ? { pickupLocation: body.pickupLocation } : {}),
      ...(body.dropoffLocation !== undefined ? { dropoffLocation: body.dropoffLocation } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.bookingId !== undefined ? { bookingId: body.bookingId } : {}),
      ...(body.delegateId !== undefined ? { delegateId: body.delegateId } : {}),
    },
    select: TRANSFER_SELECT,
  });

  if (body.requestProviderBooking) {
    row = await applyTransferProviderBooking(row);
  }

  await writeAudit({
    userId: actorUserId,
    action: "mice.transfer_updated",
    resourceType: "MiceTransfer",
    resourceId: row.id,
    metadata: { eventId, status: row.status },
  }).catch(() => {});

  return enrichTransfer(row, { capability: getMiceTransferCapability() });
}

export async function bookTransfer(eventId, transferId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  const existing = await prisma.miceTransfer.findFirst({
    where: { id: transferId, eventId },
    select: TRANSFER_SELECT,
  });
  if (!existing) throw new AppError(404, "Transfer not found");
  if (existing.status === "CONFIRMED" && existing.transferRef) {
    return enrichTransfer(existing, {
      capability: getMiceTransferCapability(),
      skippedDuplicate: true,
    });
  }
  const row = await applyTransferProviderBooking(existing);
  await writeAudit({
    userId: actorUserId,
    action: "mice.transfer_book_attempt",
    resourceType: "MiceTransfer",
    resourceId: row.id,
    metadata: { eventId, status: row.status, transferRef: row.transferRef },
  }).catch(() => {});
  return enrichTransfer(row, { capability: getMiceTransferCapability() });
}

export async function listTransfers(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const capability = getMiceTransferCapability();
  const rows = await prisma.miceTransfer.findMany({
    where: { eventId },
    orderBy: [{ pickupAt: "asc" }, { createdAt: "asc" }],
    select: TRANSFER_SELECT,
  });
  const enriched = [];
  for (const row of rows) {
    enriched.push(await enrichTransfer(row, { capability }));
  }
  return {
    capability,
    items: enriched,
  };
}

export function getTransferCapability() {
  return getMiceTransferCapability();
}

async function assertDelegateOnEvent(eventId, delegateId) {
  if (!delegateId) return;
  const d = await prisma.miceDelegate.findFirst({
    where: { id: delegateId, eventId },
    select: { id: true },
  });
  if (!d) throw new AppError(404, "Delegate not found");
}

async function assertBookingLinkable(eventId, actorUserId, actorPerms, bookingId) {
  const event = await getEventOrThrow(eventId);
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    select: { id: true, userId: true },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (
    booking.userId !== actorUserId &&
    event.createdByUserId !== actorUserId &&
    !isPlatformOverride(actorPerms)
  ) {
    const ownerDelegate = await prisma.miceDelegate.findFirst({
      where: { eventId, userId: booking.userId, registrationStatus: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (!ownerDelegate) {
      throw new AppError(403, "Booking must belong to you or a registered delegate");
    }
  }
}

/**
 * Flight booking must already be linked to this event as FLIGHT (or be linkable + FLIGHT product).
 */
async function resolveFlightBookingLink(eventId, actorUserId, actorPerms, flightBookingId) {
  if (!flightBookingId) return null;
  const share = await prisma.miceBookingShare.findFirst({
    where: { eventId, bookingId: flightBookingId },
    select: { id: true, kind: true },
  });
  if (share) {
    if (share.kind !== "FLIGHT" && share.kind !== "OTHER") {
      throw new AppError(400, "flightBookingId must reference a FLIGHT-linked booking for this event");
    }
    const booking = await prisma.booking.findFirst({
      where: { id: flightBookingId },
      select: { product: true },
    });
    if (booking && booking.product !== "FLIGHT" && share.kind !== "FLIGHT") {
      throw new AppError(400, "flightBookingId must be a FLIGHT booking");
    }
    return flightBookingId;
  }
  // Not yet shared — validate access and product, then require organizer to link first.
  await assertBookingLinkable(eventId, actorUserId, actorPerms, flightBookingId);
  const booking = await prisma.booking.findFirst({
    where: { id: flightBookingId },
    select: { product: true },
  });
  if (!booking || booking.product !== "FLIGHT") {
    throw new AppError(400, "flightBookingId must be a FLIGHT booking linked to this event");
  }
  throw new AppError(
    409,
    "Link the flight booking to this event (POST /travel) before attaching it to a transfer",
  );
}

async function applyTransferProviderBooking(row) {
  if (row.status === "CONFIRMED" && row.transferRef) return row;
  const result = await attemptMiceTransferBooking({
    transferId: row.id,
    eventId: row.eventId,
    direction: row.direction,
    label: row.label,
    passengerCount: row.passengerCount,
    airportCode: row.airportCode,
    flightRef: row.flightRef,
    flightBookingId: row.flightBookingId,
    pickupAt: row.pickupAt,
    pickupLocation: row.pickupLocation,
    dropoffLocation: row.dropoffLocation,
    notes: row.notes,
    idempotencyKey: row.idempotencyKey || row.id,
  });

  const nextStatus = result.status;
  return prisma.miceTransfer.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      providerStatus: result.providerStatus,
      providerReason: result.reason,
      transferRef: result.ok ? result.transferRef : row.transferRef,
      confirmedAt: result.ok ? new Date() : row.confirmedAt,
      // Never invent a bookingId from provider unless they return one we already validated.
    },
    select: TRANSFER_SELECT,
  });
}

async function enrichTransfer(row, { capability, skippedDuplicate = false } = {}) {
  let flightLinkage = null;
  if (row.flightBookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: row.flightBookingId },
      select: {
        id: true,
        product: true,
        status: true,
        externalRef: true,
        metadata: true,
      },
    });
    if (booking) {
      const meta = booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
      flightLinkage = {
        bookingId: booking.id,
        product: booking.product,
        bookingStatus: booking.status,
        externalRef: booking.externalRef,
        flightNumber: meta.flightNumber || row.flightRef || null,
        // Never invent live flight status — Module 09 must be configured separately.
        liveFlightStatus: "DATA_UNAVAILABLE",
        liveFlightReason:
          "Live flight status is not invented here — use Module 09 JourneyWatch when configured",
      };
    } else {
      flightLinkage = {
        bookingId: row.flightBookingId,
        liveFlightStatus: "DATA_UNAVAILABLE",
        liveFlightReason: "Linked flight booking no longer found",
      };
    }
  }

  let liveTransferStatus = null;
  if (row.transferRef || row.bookingId || row.pickupAt) {
    const live = await fetchMiceTransferLiveStatus({
      bookingId: row.bookingId || row.id,
      transferRef: row.transferRef,
      pickupAt: row.pickupAt,
    });
    liveTransferStatus = {
      dataStatus: live.dataStatus,
      isFact: live.isFact,
      reason: live.reason,
      snapshot: live.isFact ? live.snapshot : null,
    };
  }

  return {
    ...row,
    skippedDuplicate: Boolean(skippedDuplicate),
    provider: {
      book: {
        configured: capability?.configured ?? false,
        canBookLive: capability?.canBookLive ?? false,
        provider: capability?.provider ?? "unconfigured",
        reasons: capability?.reasons || [],
      },
      liveStatus: capability?.liveStatus || null,
    },
    flightLinkage,
    liveTransferStatus,
  };
}

export async function upsertBudgetLine(eventId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  assertNonNegativeMinorAmount(body.plannedMinor ?? 0, "plannedMinor");
  assertNonNegativeMinorAmount(body.actualMinor ?? 0, "actualMinor");
  if (body.id) {
    const existing = await prisma.miceBudgetLine.findFirst({
      where: { id: body.id, eventId },
      select: { id: true },
    });
    if (!existing) throw new AppError(404, "Budget line not found");
    return prisma.miceBudgetLine.update({
      where: { id: body.id },
      data: {
        category: body.category,
        label: body.label,
        plannedMinor: body.plannedMinor ?? 0,
        actualMinor: body.actualMinor ?? 0,
      },
      select: BUDGET_LINE_SELECT,
    });
  }
  return prisma.miceBudgetLine.create({
    data: {
      eventId,
      category: body.category,
      label: body.label,
      plannedMinor: body.plannedMinor ?? 0,
      actualMinor: body.actualMinor ?? 0,
    },
    select: BUDGET_LINE_SELECT,
  });
}

export async function getBudget(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const isManager =
    event.createdByUserId === actorUserId ||
    isPlatformOverride(actorPerms) ||
    (await isGroupOrganizer(event.groupId, actorUserId));
  if (!isManager) {
    return {
      currency: event.currency,
      budgetMinor: event.budgetMinor,
      lines: [],
      note: "Detailed budget lines are organizer-only",
    };
  }
  const lines = await prisma.miceBudgetLine.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: BUDGET_LINE_SELECT,
  });
  const travel = await listLinkedTravel(eventId, actorUserId, actorPerms);
  const travelActual = (travel.items || []).reduce(
    (sum, it) => sum + (Number(it.booking?.amountMinor) || 0),
    0,
  );
  const plannedLines = lines.reduce((s, l) => s + l.plannedMinor, 0);
  const actualLines = lines.reduce((s, l) => s + l.actualMinor, 0);
  return {
    currency: event.currency,
    budgetCeilingMinor: event.budgetMinor,
    lines,
    plannedLinesMinor: plannedLines,
    actualLinesMinor: actualLines,
    travelActualMinor: travelActual,
    plannedTotalMinor: (event.budgetMinor || 0) + plannedLines,
    actualTotalMinor: actualLines + travelActual,
  };
}

export async function createSponsor(eventId, actorUserId, actorPerms, body) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  return prisma.miceSponsor.create({
    data: {
      eventId,
      name: body.name,
      tier: body.tier || null,
      contactEmail: body.contactEmail || null,
      deliverables: body.deliverables || null,
      note: body.note || null,
    },
    select: SPONSOR_SELECT,
  });
}

export async function listSponsors(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventReadAccess(event, actorUserId, actorPerms);
  const isManager =
    event.createdByUserId === actorUserId ||
    isPlatformOverride(actorPerms) ||
    (await isGroupOrganizer(event.groupId, actorUserId));
  const rows = await prisma.miceSponsor.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: SPONSOR_SELECT,
  });
  if (isManager) return rows;
  return rows.map((s) => ({
    id: s.id,
    eventId: s.eventId,
    name: s.name,
    tier: s.tier,
    contactEmail: null,
    deliverables: s.deliverables,
    note: null,
    createdAt: s.createdAt,
  }));
}

/** Event report from attributed stored data only. */
export async function getEventReport(eventId, actorUserId, actorPerms) {
  const event = await getEventOrThrow(eventId);
  await assertEventManager(event, actorUserId, actorPerms);
  const [attendance, travel, budget, sponsors, sessions, delegates, transfers] = await Promise.all([
    getAttendance(eventId, actorUserId, actorPerms),
    listLinkedTravel(eventId, actorUserId, actorPerms),
    getBudget(eventId, actorUserId, actorPerms),
    listSponsors(eventId, actorUserId, actorPerms),
    listSessions(eventId, actorUserId, actorPerms),
    prisma.miceDelegate.count({ where: { eventId, registrationStatus: { not: "CANCELLED" } } }),
    listTransfers(eventId, actorUserId, actorPerms),
  ]);

  return {
    event: {
      id: event.id,
      name: event.name,
      type: event.type,
      venue: event.venue,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    },
    registrations: {
      activeDelegates: delegates,
      byStatus: attendance.byRegistrationStatus,
    },
    attendance: {
      checkInsBySession: attendance.checkInsBySession,
    },
    agendaSessionCount: sessions.length,
    travel: {
      linkedBookings: travel.items?.length || 0,
      byKind: (travel.items || []).reduce((acc, it) => {
        acc[it.kind] = (acc[it.kind] || 0) + 1;
        return acc;
      }, {}),
      items: travel.items || [],
    },
    transfers: {
      count: transfers.items?.length || 0,
      byStatus: (transfers.items || []).reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {}),
      byDirection: (transfers.items || []).reduce((acc, t) => {
        acc[t.direction] = (acc[t.direction] || 0) + 1;
        return acc;
      }, {}),
      provider: transfers.capability,
      items: (transfers.items || []).map((t) => ({
        id: t.id,
        label: t.label,
        direction: t.direction,
        status: t.status,
        airportCode: t.airportCode,
        flightRef: t.flightRef,
        transferRef: t.transferRef,
        providerReason: t.providerReason,
      })),
    },
    budget,
    sponsors: {
      count: sponsors.length,
      names: sponsors.map((s) => s.name),
    },
    generatedAt: new Date().toISOString(),
    note: "Report uses only stored event data — no fabricated metrics.",
  };
}

export async function getAvaMiceContext(userId) {
  if (!userId) {
    return {
      promptBlock:
        "MICE: Sign in to see events you organize or are registered for. Never invent delegates, budgets, or attendance.",
    };
  }
  const events = await listEvents(userId, null);
  if (!events.length) {
    return {
      promptBlock:
        "MICE: No authorized events for this user. Never invent agenda, attendance, sponsors, or budgets.",
    };
  }
  const summary = events
    .slice(0, 5)
    .map((e) => `${e.name}[${e.id}] type=${e.type}`)
    .join("; ");
  return {
    promptBlock: [
      "MICE (Module 12 — authorized events only):",
      summary,
      "Never invent flights/hotels/prices. Budget and sponsors are organizer-scoped. Trip memories N/A.",
    ].join(" "),
  };
}

/**
 * Module 11 — Group Travel (complete Phase 2 slice).
 *
 * Collaboration layer over individual bookings/profiles/vault/journey —
 * never replaces those records. See docs/modules/11-group-travel.md.
 */
import crypto from "node:crypto";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { randomToken } from "../../lib/crypto.js";
import { writeAudit } from "../../lib/audit.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import {
  decodeBase64Content,
  getVaultStorage,
  getVaultStorageCapability,
  sha256Buffer,
  validateUploadPayload,
} from "../vault/vault.storage.js";
import { getJourneyStatusCapability, fetchFlightStatus } from "../journey/journey.statusProvider.js";
import { notifyGroupMembers } from "./groups.notify.js";
import { ORGANIZER_ROLES } from "./groups.constants.js";

const EMERGENCY_PRIORITY = 100;
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const GROUP_SELECT = {
  id: true,
  name: true,
  type: true,
  createdByUserId: true,
  inviteCode: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

const MEMBER_SELECT = {
  id: true,
  groupId: true,
  userId: true,
  role: true,
  status: true,
  joinedAt: true,
  createdAt: true,
};

const ANNOUNCEMENT_SELECT = {
  id: true,
  groupId: true,
  authorUserId: true,
  body: true,
  priority: true,
  isEmergency: true,
  createdAt: true,
};

const POLL_SELECT = {
  id: true,
  groupId: true,
  question: true,
  options: true,
  createdByUserId: true,
  closesAt: true,
  createdAt: true,
};

const BOOKING_SHARE_SELECT = {
  id: true,
  groupId: true,
  bookingId: true,
  sharedByUserId: true,
  createdAt: true,
};

const DOCUMENT_SHARE_SELECT = {
  id: true,
  groupId: true,
  vaultDocumentId: true,
  sharedByUserId: true,
  label: true,
  createdAt: true,
};

const WAYPOINT_SELECT = {
  id: true,
  groupId: true,
  label: true,
  scheduledAt: true,
  createdByUserId: true,
  createdAt: true,
};

const ATTENDANCE_RECORD_SELECT = {
  id: true,
  waypointId: true,
  groupId: true,
  userId: true,
  status: true,
  notedByUserId: true,
  note: true,
  createdAt: true,
  updatedAt: true,
};

async function listActiveMemberUserIds(groupId) {
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: "ACTIVE" },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function isPlatformOverride(perms) {
  return Boolean(perms && hasPermissionEff(perms, "groups:write"));
}

async function getGroupOrThrow(groupId, select = GROUP_SELECT) {
  const group = await prisma.travelGroup.findUnique({ where: { id: groupId }, select });
  if (!group) throw new AppError(404, "Group not found");
  return group;
}

/** Active membership required for content access. */
async function assertActiveMember(groupId, userId, perms) {
  if (isPlatformOverride(perms)) return { role: "ORGANIZER", status: "ACTIVE" };
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new AppError(403, "Not an active member of this group");
  }
  return membership;
}

async function assertGroupOrganizer(groupId, userId, perms) {
  if (isPlatformOverride(perms)) return { role: "ORGANIZER", status: "ACTIVE" };
  const membership = await assertActiveMember(groupId, userId, perms);
  if (!ORGANIZER_ROLES.includes(membership.role)) {
    throw new AppError(403, "Only a group organizer/admin can do this");
  }
  return membership;
}

/** @deprecated alias — kept for mice imports / older callers */
async function assertGroupMember(groupId, userId, perms) {
  return assertActiveMember(groupId, userId, perms);
}

function generateInviteCode() {
  return randomToken(6).toUpperCase();
}

function publicMemberView(row, userMap) {
  const u = userMap.get(row.userId);
  return {
    ...row,
    displayName: u?.name || null,
    // Never expose email to non-organizers via list — organizers get email separately.
  };
}

export async function createGroup(creatorUserId, { name, type, metadata }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode();
    try {
      const group = await prisma.$transaction(async (tx) => {
        const created = await tx.travelGroup.create({
          data: {
            name,
            type,
            createdByUserId: creatorUserId,
            inviteCode,
            metadata: metadata ?? null,
          },
          select: GROUP_SELECT,
        });
        await tx.groupMember.create({
          data: {
            groupId: created.id,
            userId: creatorUserId,
            role: "ORGANIZER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        });
        return created;
      });
      await writeAudit({
        userId: creatorUserId,
        action: "groups.create",
        resourceType: "TravelGroup",
        resourceId: group.id,
        metadata: { type: group.type },
      });
      return group;
    } catch (e) {
      if (e.code === "P2002" && e.meta?.target?.includes?.("inviteCode")) continue;
      throw e;
    }
  }
  throw new AppError(500, "Could not generate a unique invite code, try again");
}

export async function listMyGroups(userId) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, status: { in: ["ACTIVE", "INVITED"] } },
    select: { groupId: true, role: true, status: true },
  });
  if (!memberships.length) return [];
  const byId = new Map(memberships.map((m) => [m.groupId, m]));
  const groups = await prisma.travelGroup.findMany({
    where: { id: { in: [...byId.keys()] } },
    orderBy: { createdAt: "desc" },
    select: GROUP_SELECT,
  });
  return groups.map((g) => ({
    ...g,
    myRole: byId.get(g.id)?.role ?? null,
    myStatus: byId.get(g.id)?.status ?? null,
  }));
}

export async function getGroup(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const group = await getGroupOrThrow(groupId);
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: actorUserId } },
    select: MEMBER_SELECT,
  });
  return { ...group, myMembership: membership };
}

export async function joinGroupByInviteCode(userId, inviteCode) {
  const group = await prisma.travelGroup.findUnique({
    where: { inviteCode: String(inviteCode).trim().toUpperCase() },
    select: { id: true, name: true },
  });
  if (!group) throw new AppError(404, "Invalid invite code");

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      return prisma.groupMember.findUnique({ where: { id: existing.id }, select: MEMBER_SELECT });
    }
    if (existing.status === "DECLINED") {
      throw new AppError(409, "You previously declined this invitation");
    }
    return prisma.groupMember.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", joinedAt: new Date() },
      select: MEMBER_SELECT,
    });
  }

  return prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
    select: MEMBER_SELECT,
  });
}

/** Organizer invites by userId or email → INVITED (accept/decline required). */
export async function inviteMember(groupId, actorUserId, actorPerms, { userId, email, role }) {
  await getGroupOrThrow(groupId);
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);

  let targetUserId = userId;
  if (!targetUserId && email) {
    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new AppError(404, "No FlightOne account with that email");
    targetUserId = user.id;
  }
  if (!targetUserId) throw new AppError(400, "userId or email is required");
  if (targetUserId === actorUserId) throw new AppError(400, "Cannot invite yourself");

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "ACTIVE") {
    throw new AppError(409, "User is already an active member");
  }
  if (existing?.status === "INVITED") {
    return prisma.groupMember.findUnique({ where: { id: existing.id }, select: MEMBER_SELECT });
  }

  let member;
  if (existing) {
    member = await prisma.groupMember.update({
      where: { id: existing.id },
      data: { status: "INVITED", role: role ?? "MEMBER", joinedAt: null },
      select: MEMBER_SELECT,
    });
  } else {
    member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUserId,
        role: role ?? "MEMBER",
        status: "INVITED",
      },
      select: MEMBER_SELECT,
    });
  }

  const group = await getGroupOrThrow(groupId, { id: true, name: true });
  await notifyGroupMembers({
    groupId,
    memberUserIds: [targetUserId],
    dedupeKeyPrefix: `group-invite:${groupId}:${member.id}`,
    title: "Group invitation",
    body: `You were invited to join “${group.name}”. Open Groups to accept or decline.`,
    payload: { kind: "invite", membershipId: member.id },
    channels: ["APP", "EMAIL"],
  });
  await writeAudit({
    userId: actorUserId,
    action: "groups.invite",
    resourceType: "TravelGroup",
    resourceId: groupId,
    metadata: { invitedUserId: targetUserId },
  });
  return member;
}

/** Organizer direct-add → ACTIVE (vouch path). */
export async function addMember(groupId, actorUserId, actorPerms, { userId, role }) {
  await getGroupOrThrow(groupId);
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "ACTIVE") {
    throw new AppError(409, "User is already a member of this group");
  }
  if (existing) {
    return prisma.groupMember.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        role: role ?? "MEMBER",
        joinedAt: new Date(),
      },
      select: MEMBER_SELECT,
    });
  }

  try {
    return await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: role ?? "MEMBER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      select: MEMBER_SELECT,
    });
  } catch (e) {
    if (e.code === "P2002") throw new AppError(409, "User is already a member of this group");
    throw e;
  }
}

export async function acceptInvitation(groupId, userId) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: MEMBER_SELECT,
  });
  if (!membership || membership.status !== "INVITED") {
    throw new AppError(404, "No pending invitation for this group");
  }
  return prisma.groupMember.update({
    where: { id: membership.id },
    data: { status: "ACTIVE", joinedAt: new Date() },
    select: MEMBER_SELECT,
  });
}

export async function declineInvitation(groupId, userId) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: MEMBER_SELECT,
  });
  if (!membership || membership.status !== "INVITED") {
    throw new AppError(404, "No pending invitation for this group");
  }
  return prisma.groupMember.update({
    where: { id: membership.id },
    data: { status: "DECLINED" },
    select: MEMBER_SELECT,
  });
}

export async function leaveGroup(groupId, userId) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: MEMBER_SELECT,
  });
  if (!membership || membership.status === "LEFT") {
    throw new AppError(404, "Not a member of this group");
  }
  const group = await getGroupOrThrow(groupId, { createdByUserId: true });
  if (group.createdByUserId === userId && membership.role === "ORGANIZER") {
    const otherOrganizers = await prisma.groupMember.count({
      where: {
        groupId,
        status: "ACTIVE",
        role: { in: ORGANIZER_ROLES },
        userId: { not: userId },
      },
    });
    if (otherOrganizers === 0) {
      throw new AppError(409, "Transfer organizer role before leaving");
    }
  }
  return prisma.groupMember.update({
    where: { id: membership.id },
    data: { status: "LEFT" },
    select: MEMBER_SELECT,
  });
}

export async function listMembers(groupId, actorUserId, actorPerms) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: { in: isOrg ? ["ACTIVE", "INVITED"] : ["ACTIVE"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: MEMBER_SELECT,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return members.map((m) => ({
    ...publicMemberView(m, userMap),
    email: isOrg ? userMap.get(m.userId)?.email ?? null : null,
  }));
}

export async function createAnnouncement(groupId, actorUserId, actorPerms, { body, priority }) {
  await getGroupOrThrow(groupId);
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);

  const ann = await prisma.groupAnnouncement.create({
    data: {
      groupId,
      authorUserId: actorUserId,
      body,
      priority: priority ?? 0,
      isEmergency: false,
    },
    select: ANNOUNCEMENT_SELECT,
  });

  const memberIds = await listActiveMemberUserIds(groupId);
  await notifyGroupMembers({
    groupId,
    memberUserIds: memberIds,
    dedupeKeyPrefix: `group-announcement:${ann.id}`,
    title: "Group announcement",
    body: body.slice(0, 240),
    payload: { kind: "announcement", announcementId: ann.id },
    channels: ["APP"],
  });
  await writeAudit({
    userId: actorUserId,
    action: "groups.announcement",
    resourceType: "TravelGroup",
    resourceId: groupId,
    metadata: { announcementId: ann.id },
  });
  return ann;
}

export async function createEmergencyBroadcast(groupId, actorUserId, actorPerms, { body }) {
  await getGroupOrThrow(groupId);
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);
  if (!body || !String(body).trim()) throw new AppError(400, "body is required");

  const ann = await prisma.groupAnnouncement.create({
    data: {
      groupId,
      authorUserId: actorUserId,
      body: String(body).trim(),
      priority: EMERGENCY_PRIORITY,
      isEmergency: true,
    },
    select: ANNOUNCEMENT_SELECT,
  });

  const memberIds = await listActiveMemberUserIds(groupId);
  // Safety override: all configured channels, ignore preference throttling (no prefs table yet).
  await notifyGroupMembers({
    groupId,
    memberUserIds: memberIds,
    dedupeKeyPrefix: `group-emergency:${ann.id}`,
    title: "EMERGENCY — group broadcast",
    body: String(body).trim().slice(0, 400),
    payload: { kind: "emergency", announcementId: ann.id },
    channels: ["APP", "EMAIL", "WHATSAPP"],
  });
  await writeAudit({
    userId: actorUserId,
    action: "groups.emergency",
    resourceType: "TravelGroup",
    resourceId: groupId,
    metadata: { announcementId: ann.id },
  });
  return ann;
}

export async function listAnnouncements(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  return prisma.groupAnnouncement.findMany({
    where: { groupId },
    orderBy: [{ isEmergency: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    select: ANNOUNCEMENT_SELECT,
  });
}

export async function createPoll(groupId, actorUserId, actorPerms, { question, options, closesAt }) {
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);
  return prisma.groupPoll.create({
    data: {
      groupId,
      question,
      options,
      createdByUserId: actorUserId,
      closesAt: closesAt ?? null,
    },
    select: POLL_SELECT,
  });
}

export async function voteOnPoll(groupId, pollId, actorUserId, actorPerms, { optionIndex }) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const poll = await prisma.groupPoll.findFirst({
    where: { id: pollId, groupId },
    select: { id: true, options: true, closesAt: true },
  });
  if (!poll) throw new AppError(404, "Poll not found");
  if (poll.closesAt && poll.closesAt.getTime() <= Date.now()) {
    throw new AppError(409, "This poll is closed");
  }
  const optionCount = Array.isArray(poll.options) ? poll.options.length : 0;
  if (optionIndex < 0 || optionIndex >= optionCount) {
    throw new AppError(400, "optionIndex is out of range for this poll's options");
  }
  return prisma.groupPollVote.upsert({
    where: { pollId_userId: { pollId, userId: actorUserId } },
    update: { optionIndex },
    create: { pollId, userId: actorUserId, optionIndex },
  });
}

export async function listPolls(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const polls = await prisma.groupPoll.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: POLL_SELECT,
  });
  if (!polls.length) return [];
  const pollIds = polls.map((p) => p.id);
  const counts = await prisma.groupPollVote.groupBy({
    by: ["pollId", "optionIndex"],
    where: { pollId: { in: pollIds } },
    _count: { _all: true },
  });
  const myVotes = await prisma.groupPollVote.findMany({
    where: { pollId: { in: pollIds }, userId: actorUserId },
    select: { pollId: true, optionIndex: true },
  });
  const myByPoll = new Map(myVotes.map((v) => [v.pollId, v.optionIndex]));
  const countsByPoll = new Map();
  for (const row of counts) {
    if (!countsByPoll.has(row.pollId)) countsByPoll.set(row.pollId, {});
    countsByPoll.get(row.pollId)[row.optionIndex] = row._count._all;
  }
  return polls.map((poll) => ({
    ...poll,
    voteCounts: countsByPoll.get(poll.id) ?? {},
    myOptionIndex: myByPoll.has(poll.id) ? myByPoll.get(poll.id) : null,
  }));
}

/** Share own booking into group itinerary (no booking duplication). */
export async function shareBooking(groupId, actorUserId, actorPerms, { bookingId }) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: actorUserId },
    select: { id: true, status: true, userId: true },
  });
  if (!booking) throw new AppError(404, "Booking not found or not owned by you");

  try {
    return await prisma.groupBookingShare.create({
      data: { groupId, bookingId, sharedByUserId: actorUserId },
    });
  } catch (e) {
    if (e.code === "P2002") throw new AppError(409, "Booking already shared with this group");
    throw e;
  }
}

export async function unshareBooking(groupId, shareId, actorUserId, actorPerms) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const share = await prisma.groupBookingShare.findFirst({
    where: { id: shareId, groupId },
    select: BOOKING_SHARE_SELECT,
  });
  if (!share) throw new AppError(404, "Shared booking not found");
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  if (share.sharedByUserId !== actorUserId && !isOrg) {
    throw new AppError(403, "Only the sharer or an organizer can remove this");
  }
  await prisma.groupBookingShare.delete({ where: { id: shareId } });
  return { deleted: true };
}

export async function getSharedItinerary(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const shares = await prisma.groupBookingShare.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: BOOKING_SHARE_SELECT,
  });
  if (!shares.length) return { items: [], capability: getJourneyStatusCapability() };

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
      supplierCode: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const items = shares
    .map((s) => {
      const b = bookingMap.get(s.bookingId);
      if (!b) return null;
      return {
        shareId: s.id,
        sharedByUserId: s.sharedByUserId,
        sharedAt: s.createdAt,
        booking: {
          id: b.id,
          status: b.status,
          product: b.product,
          currency: b.currency,
          amountMinor: b.amountMinor,
          externalRef: b.externalRef,
          supplierCode: b.supplierCode,
          // Safe itinerary slice only — never invent legs.
          itinerary: extractItinerarySlice(b.metadata),
          updatedAt: b.updatedAt,
        },
      };
    })
    .filter(Boolean);

  return { items, capability: getJourneyStatusCapability() };
}

function extractItinerarySlice(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const snap = metadata.snapshot || metadata.itinerary || null;
  if (!snap || typeof snap !== "object") {
    return {
      note: "No structured itinerary snapshot on this booking",
      productHint: metadata.product || null,
    };
  }
  return {
    origin: snap.origin || snap.from || null,
    destination: snap.destination || snap.to || null,
    departAt: snap.departAt || snap.departureAt || null,
    arriveAt: snap.arriveAt || snap.arrivalAt || null,
    carrier: snap.carrier || snap.airline || null,
    flightNumber: snap.flightNumber || null,
  };
}

/** Live status for shared bookings — fail-closed via Module 09 provider. */
export async function getGroupFlightStatus(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const capability = getJourneyStatusCapability();
  const { items } = await getSharedItinerary(groupId, actorUserId, actorPerms);

  if (!capability.canPollLive) {
    return {
      capability,
      updates: items.map((it) => ({
        bookingId: it.booking.id,
        dataStatus: "UNAVAILABLE",
        isFact: false,
        reason: capability.reasons[0] || "Flight status provider unconfigured",
        itinerary: it.booking.itinerary,
      })),
    };
  }

  const updates = [];
  for (const it of items) {
    const slice = it.booking.itinerary;
    const flightNumber = slice?.flightNumber;
    const departAt = slice?.departAt;
    if (!flightNumber || !departAt) {
      updates.push({
        bookingId: it.booking.id,
        dataStatus: "INSUFFICIENT_ATTRIBUTES",
        isFact: false,
        reason: "Shared booking lacks attributed flight number / departAt",
        itinerary: slice,
      });
      continue;
    }
    try {
      const result = await fetchFlightStatus({
        flightNumber,
        departAt,
        origin: slice.origin,
        destination: slice.destination,
      });
      updates.push({
        bookingId: it.booking.id,
        dataStatus: result?.dataStatus || "UNKNOWN",
        isFact: Boolean(result?.isFact),
        snapshot: result?.snapshot || null,
        reason: result?.reason || null,
        itinerary: slice,
      });
    } catch (e) {
      updates.push({
        bookingId: it.booking.id,
        dataStatus: "PROVIDER_ERROR",
        isFact: false,
        reason: e.message || "Status fetch failed",
        itinerary: slice,
      });
    }
  }
  return { capability, updates };
}

/** Verified booking transitions for shared itinerary (never invented). */
export async function getLiveItineraryUpdates(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const shares = await prisma.groupBookingShare.findMany({
    where: { groupId },
    select: { bookingId: true },
  });
  const bookingIds = shares.map((s) => s.bookingId);
  if (!bookingIds.length) return { items: [] };

  const transitions = await prisma.bookingTransition.findMany({
    where: { bookingId: { in: bookingIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      bookingId: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
    },
  });
  return { items: transitions };
}

export async function shareVaultDocument(groupId, actorUserId, actorPerms, { vaultDocumentId, label }) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const doc = await prisma.vaultDocument.findFirst({
    where: { id: vaultDocumentId, ownerUserId: actorUserId, isActive: true },
    select: { id: true, title: true, type: true },
  });
  if (!doc) throw new AppError(404, "Vault document not found or not owned by you");

  try {
    return await prisma.groupDocumentShare.create({
      data: {
        groupId,
        vaultDocumentId,
        sharedByUserId: actorUserId,
        label: label || doc.title || null,
      },
    });
  } catch (e) {
    if (e.code === "P2002") throw new AppError(409, "Document already shared with this group");
    throw e;
  }
}

export async function listSharedDocuments(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const shares = await prisma.groupDocumentShare.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_SHARE_SELECT,
  });
  if (!shares.length) return { items: [] };
  const docs = await prisma.vaultDocument.findMany({
    where: {
      id: { in: shares.map((s) => s.vaultDocumentId) },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      type: true,
      contentType: true,
      byteSize: true,
      ownerUserId: true,
      createdAt: true,
    },
  });
  const docMap = new Map(docs.map((d) => [d.id, d]));
  return {
    items: shares
      .map((s) => {
        const d = docMap.get(s.vaultDocumentId);
        if (!d) return null;
        return {
          shareId: s.id,
          label: s.label,
          sharedByUserId: s.sharedByUserId,
          sharedAt: s.createdAt,
          document: {
            id: d.id,
            title: d.title,
            type: d.type,
            contentType: d.contentType,
            byteSize: d.byteSize,
            // No binary / storage keys — members open via owner share or vault if owner.
          },
        };
      })
      .filter(Boolean),
  };
}

export async function unshareDocument(groupId, shareId, actorUserId, actorPerms) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const share = await prisma.groupDocumentShare.findFirst({
    where: { id: shareId, groupId },
    select: DOCUMENT_SHARE_SELECT,
  });
  if (!share) throw new AppError(404, "Shared document not found");
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  if (share.sharedByUserId !== actorUserId && !isOrg) {
    throw new AppError(403, "Only the sharer or an organizer can remove this");
  }
  await prisma.groupDocumentShare.delete({ where: { id: shareId } });
  return { deleted: true };
}

export async function createAttendanceWaypoint(groupId, actorUserId, actorPerms, { label, scheduledAt }) {
  await assertGroupOrganizer(groupId, actorUserId, actorPerms);
  return prisma.groupAttendanceWaypoint.create({
    data: {
      groupId,
      label,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdByUserId: actorUserId,
    },
  });
}

export async function markAttendance(
  groupId,
  waypointId,
  actorUserId,
  actorPerms,
  { userId, status, note },
) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const waypoint = await prisma.groupAttendanceWaypoint.findFirst({
    where: { id: waypointId, groupId },
    select: WAYPOINT_SELECT,
  });
  if (!waypoint) throw new AppError(404, "Attendance waypoint not found");

  const targetUserId = userId || actorUserId;
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  if (targetUserId !== actorUserId && !isOrg) {
    throw new AppError(403, "Members may only mark their own attendance");
  }
  if (targetUserId !== actorUserId) {
    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { status: true },
    });
    if (!target || target.status !== "ACTIVE") {
      throw new AppError(404, "Target is not an active group member");
    }
  }

  const allowed = ["PRESENT", "ABSENT", "EXCUSED"];
  const st = allowed.includes(status) ? status : "PRESENT";

  return prisma.groupAttendanceRecord.upsert({
    where: { waypointId_userId: { waypointId, userId: targetUserId } },
    update: { status: st, note: note || null, notedByUserId: actorUserId },
    create: {
      waypointId,
      groupId,
      userId: targetUserId,
      status: st,
      notedByUserId: actorUserId,
      note: note || null,
    },
  });
}

export async function listAttendance(groupId, actorUserId, actorPerms) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  const waypoints = await prisma.groupAttendanceWaypoint.findMany({
    where: { groupId },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    select: WAYPOINT_SELECT,
  });
  const records = await prisma.groupAttendanceRecord.findMany({
    where: {
      groupId,
      ...(isOrg ? {} : { userId: actorUserId }),
    },
    select: ATTENDANCE_RECORD_SELECT,
  });
  return { waypoints, records, scope: isOrg ? "group" : "self" };
}

export async function uploadGroupPhoto(groupId, actorUserId, actorPerms, body) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const cap = getVaultStorageCapability();
  if (!cap.canUpload) {
    throw Object.assign(new AppError(503, "Photo storage is not configured"), {
      code: "VAULT_STORAGE_UNCONFIGURED",
      details: { capability: cap },
    });
  }

  const buffer = decodeBase64Content(body.contentBase64);
  const validated = validateUploadPayload({
    contentType: body.contentType,
    originalFilename: body.originalFilename || "photo.jpg",
    byteLength: buffer.length,
  });
  if (!PHOTO_MIME.has(validated.contentType)) {
    throw new AppError(400, "Only JPEG, PNG, or WebP photos are allowed in the gallery");
  }

  const photoId = crypto.randomBytes(12).toString("hex");
  const storageKey = `groups/${groupId}/${photoId}/${validated.originalFilename}`;
  const storage = getVaultStorage();
  await storage.put({ storageKey, buffer });

  return prisma.groupPhoto.create({
    data: {
      id: photoId,
      groupId,
      uploadedByUserId: actorUserId,
      caption: body.caption || null,
      contentType: validated.contentType,
      byteSize: buffer.length,
      storageKey,
      contentSha256: sha256Buffer(buffer),
    },
    select: {
      id: true,
      groupId: true,
      uploadedByUserId: true,
      caption: true,
      contentType: true,
      byteSize: true,
      createdAt: true,
    },
  });
}

export async function listGroupPhotos(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const photos = await prisma.groupPhoto.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      groupId: true,
      uploadedByUserId: true,
      caption: true,
      contentType: true,
      byteSize: true,
      createdAt: true,
    },
  });
  return { items: photos, storage: getVaultStorageCapability() };
}

export async function getGroupPhotoContent(groupId, photoId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const photo = await prisma.groupPhoto.findFirst({ where: { id: photoId, groupId } });
  if (!photo) throw new AppError(404, "Photo not found");
  const buffer = await getVaultStorage().get({ storageKey: photo.storageKey });
  return {
    contentBase64: buffer.toString("base64"),
    contentType: photo.contentType,
    byteSize: photo.byteSize,
    caption: photo.caption,
  };
}

export async function deleteGroupPhoto(groupId, photoId, actorUserId, actorPerms) {
  const me = await assertActiveMember(groupId, actorUserId, actorPerms);
  const photo = await prisma.groupPhoto.findFirst({ where: { id: photoId, groupId } });
  if (!photo) throw new AppError(404, "Photo not found");
  const isOrg = isPlatformOverride(actorPerms) || ORGANIZER_ROLES.includes(me.role);
  if (photo.uploadedByUserId !== actorUserId && !isOrg) {
    throw new AppError(403, "Only the uploader or an organizer can delete this photo");
  }
  await getVaultStorage().remove({ storageKey: photo.storageKey }).catch(() => {});
  await prisma.groupPhoto.delete({ where: { id: photoId } });
  return { deleted: true };
}

/**
 * Trip memory grounded only in real group data. Never invents destinations,
 * bookings, people, or activities. Insufficient data → INSUFFICIENT_DATA.
 */
export async function generateTripMemory(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  const group = await getGroupOrThrow(groupId);
  const [members, itinerary, photos, announcements] = await Promise.all([
    prisma.groupMember.count({ where: { groupId, status: "ACTIVE" } }),
    getSharedItinerary(groupId, actorUserId, actorPerms),
    prisma.groupPhoto.count({ where: { groupId } }),
    prisma.groupAnnouncement.count({ where: { groupId, isEmergency: false } }),
  ]);

  const legs = (itinerary.items || [])
    .map((it) => it.booking?.itinerary)
    .filter((s) => s && (s.origin || s.destination || s.flightNumber));

  const sourceSnapshot = {
    groupId: group.id,
    groupName: group.name,
    groupType: group.type,
    activeMembers: members,
    sharedBookingCount: itinerary.items?.length || 0,
    legs: legs.map((l) => ({
      origin: l.origin || null,
      destination: l.destination || null,
      departAt: l.departAt || null,
      flightNumber: l.flightNumber || null,
      carrier: l.carrier || null,
    })),
    photoCount: photos,
    announcementCount: announcements,
    generatedAt: new Date().toISOString(),
  };

  const hasSubstance =
    members >= 1 && (sourceSnapshot.sharedBookingCount > 0 || photos > 0 || announcements > 0);

  if (!hasSubstance) {
    return prisma.groupTripMemory.create({
      data: {
        groupId,
        createdByUserId: actorUserId,
        title: `${group.name} — memory unavailable`,
        body: "Not enough attributed group activity yet (shared bookings, photos, or announcements) to generate a trip memory. Nothing was invented.",
        sourceSnapshot,
        status: "INSUFFICIENT_DATA",
      },
    });
  }

  const lines = [
    `Trip memory for “${group.name}” (${group.type}).`,
    `Active members recorded: ${members}.`,
  ];
  if (sourceSnapshot.sharedBookingCount) {
    lines.push(`Shared bookings in group itinerary: ${sourceSnapshot.sharedBookingCount}.`);
    for (const leg of sourceSnapshot.legs) {
      const bits = [
        leg.carrier,
        leg.flightNumber,
        leg.origin && leg.destination ? `${leg.origin}→${leg.destination}` : null,
        leg.departAt,
      ].filter(Boolean);
      if (bits.length) lines.push(`• ${bits.join(" · ")}`);
    }
  }
  if (photos) lines.push(`Shared gallery photos: ${photos}.`);
  if (announcements) lines.push(`Group announcements: ${announcements}.`);
  lines.push("This summary uses only attributed group data — no destinations or events were invented.");

  return prisma.groupTripMemory.create({
    data: {
      groupId,
      createdByUserId: actorUserId,
      title: `${group.name} — trip memory`,
      body: lines.join("\n"),
      sourceSnapshot,
      status: "GROUNDED",
    },
  });
}

export async function listTripMemories(groupId, actorUserId, actorPerms) {
  await assertActiveMember(groupId, actorUserId, actorPerms);
  return prisma.groupTripMemory.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
  });
}

/** Ava grounding — authorized active-member context only; never invents. */
export async function getAvaGroupContext(userId, groupId) {
  if (!userId) {
    return {
      promptBlock:
        "GROUPS: Sign in to load authorized group context. Guests have no group itinerary, attendance, or gallery access. Never invent group data.",
    };
  }
  if (!groupId) {
    const groups = await listMyGroups(userId);
    const active = groups.filter((g) => g.myStatus === "ACTIVE");
    if (!active.length) {
      return {
        promptBlock:
          "GROUPS: This user has no active groups. Never invent members, itineraries, polls, or flight updates.",
      };
    }
    return {
      promptBlock: [
        "GROUPS (authorized list only):",
        active.map((g) => `${g.name}[${g.id}] type=${g.type} role=${g.myRole}`).join("; "),
        "Ask which group if ambiguous. Never invent flight status or private vault docs.",
      ].join(" "),
    };
  }

  try {
    await assertActiveMember(groupId, userId, null);
  } catch {
    return {
      promptBlock:
        "GROUPS: User is not an active member of the requested group — refuse details. Never invent group content.",
    };
  }

  const [group, members, itinerary, announcements, polls, attendance, photos] = await Promise.all([
    getGroupOrThrow(groupId),
    prisma.groupMember.count({ where: { groupId, status: "ACTIVE" } }),
    getSharedItinerary(groupId, userId, null),
    listAnnouncements(groupId, userId, null),
    listPolls(groupId, userId, null),
    listAttendance(groupId, userId, null),
    prisma.groupPhoto.count({ where: { groupId } }),
  ]);

  const latestAnn = announcements[0];
  const pollSummary = polls
    .slice(0, 3)
    .map((p) => `${p.question} votes=${JSON.stringify(p.voteCounts)}`)
    .join(" | ");

  return {
    promptBlock: [
      `GROUP ${group.name} (${group.type}) id=${group.id}:`,
      `activeMembers=${members}; sharedBookings=${itinerary.items?.length || 0}; photos=${photos}`,
      `latestAnnouncement=${latestAnn ? (latestAnn.isEmergency ? "EMERGENCY: " : "") + latestAnn.body.slice(0, 120) : "none"}`,
      `polls=${pollSummary || "none"}`,
      `attendanceWaypoints=${attendance.waypoints?.length || 0}`,
      "Never invent flight status — only Module 09 attributed data. Never expose private Vault docs not explicitly shared.",
    ].join(" "),
  };
}

export { assertGroupMember, assertGroupOrganizer, assertActiveMember };

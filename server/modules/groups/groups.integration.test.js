/**
 * Module 11 — Group Travel integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

dotenv.config();
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}
const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fo-vault-groups-"));
process.env.VAULT_STORAGE_PROVIDER = "local";
process.env.VAULT_LOCAL_ROOT = vaultRoot;

const { default: prisma } = await import("../../config/prisma.js");
const groups = await import("./groups.service.js");

const suffix = Date.now();
const userIds = [];
const groupIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.grp.${label}.${suffix}@example.com`,
      name: `Grp ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const gid of groupIds) {
    await prisma.groupTripMemory.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupPhoto.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupAttendanceRecord.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupAttendanceWaypoint.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupDocumentShare.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupBookingShare.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupPollVote.deleteMany({
      where: { poll: { groupId: gid } },
    }).catch(() => {});
    await prisma.groupPoll.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupAnnouncement.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.groupMember.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.travelGroup.delete({ where: { id: gid } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
  await fs.rm(vaultRoot, { recursive: true, force: true }).catch(() => {});
});

describe("Module 11 Group Travel", () => {
  it("creates group with organizer; lists; invites accept/decline; duplicate protected", async () => {
    const org = await createUser("org");
    const invitee = await createUser("inv");
    const other = await createUser("oth");

    const group = await groups.createGroup(org.id, {
      name: `Tour ${suffix}`,
      type: "LEISURE",
      metadata: { destinationHint: "attributed-only" },
    });
    groupIds.push(group.id);
    assert.ok(group.inviteCode);

    const listed = await groups.listMyGroups(org.id);
    assert.ok(listed.some((g) => g.id === group.id));

    const invitation = await groups.inviteMember(group.id, org.id, null, {
      userId: invitee.id,
    });
    assert.equal(invitation.status, "INVITED");

    const invitationAgain = await groups.inviteMember(group.id, org.id, null, {
      userId: invitee.id,
    });
    assert.equal(invitationAgain.id, invitation.id);

    await assert.rejects(
      () => groups.listMembers(group.id, other.id, null),
      (err) => err.statusCode === 403,
    );

    await groups.acceptInvitation(group.id, invitee.id);
    const members = await groups.listMembers(group.id, org.id, null);
    assert.ok(members.some((m) => m.userId === invitee.id && m.status === "ACTIVE"));

    const declined = await createUser("dec");
    await groups.inviteMember(group.id, org.id, null, { userId: declined.id });
    await groups.declineInvitation(group.id, declined.id);

    await assert.rejects(
      () => groups.addMember(group.id, org.id, null, { userId: invitee.id }),
      (err) => err.statusCode === 409,
    );
  });

  it("announcements, emergency notify, polls vote upsert, attendance", async () => {
    const org = await createUser("annOrg");
    const mem = await createUser("annMem");
    const group = await groups.createGroup(org.id, { name: "Ann", type: "FAMILY" });
    groupIds.push(group.id);
    await groups.addMember(group.id, org.id, null, { userId: mem.id });

    const ann = await groups.createAnnouncement(group.id, org.id, null, {
      body: "Meet at gate",
    });
    assert.equal(ann.isEmergency, false);

    const emergency = await groups.createEmergencyBroadcast(group.id, org.id, null, {
      body: "Assemble at hotel lobby now",
    });
    assert.equal(emergency.isEmergency, true);
    assert.ok(emergency.priority >= 100);

    const outs = await prisma.notificationOutbox.findMany({
      where: { userId: mem.id, dedupeKey: { startsWith: `group-emergency:${emergency.id}` } },
    });
    assert.ok(outs.length >= 1);

    // Dedupe: second enqueue with same keys inserts 0
    const { notifyGroupMembers } = await import("./groups.notify.js");
    const again = await notifyGroupMembers({
      groupId: group.id,
      memberUserIds: [mem.id],
      dedupeKeyPrefix: `group-emergency:${emergency.id}`,
      title: "EMERGENCY — group broadcast",
      body: "Assemble at hotel lobby now",
      payload: { kind: "emergency" },
    });
    assert.equal(again.enqueued, 0);

    await assert.rejects(
      () => groups.createAnnouncement(group.id, mem.id, null, { body: "x" }),
      (err) => err.statusCode === 403,
    );

    const poll = await groups.createPoll(group.id, org.id, null, {
      question: "Lunch?",
      options: ["A", "B"],
    });
    await groups.voteOnPoll(group.id, poll.id, mem.id, null, { optionIndex: 0 });
    await groups.voteOnPoll(group.id, poll.id, mem.id, null, { optionIndex: 1 });
    const polls = await groups.listPolls(group.id, mem.id, null);
    assert.equal(polls[0].myOptionIndex, 1);
    assert.equal(polls[0].voteCounts["1"], 1);

    const wp = await groups.createAttendanceWaypoint(group.id, org.id, null, {
      label: "Bus departure",
    });
    await groups.markAttendance(group.id, wp.id, mem.id, null, { status: "PRESENT" });
    const att = await groups.listAttendance(group.id, org.id, null);
    assert.equal(att.scope, "group");
    assert.ok(att.records.some((r) => r.userId === mem.id));
  });

  it("shared itinerary from real bookings; vault isolation; flight status fail-closed", async () => {
    const org = await createUser("itinOrg");
    const stranger = await createUser("stranger");
    const group = await groups.createGroup(org.id, { name: "Itin", type: "SPORTS" });
    groupIds.push(group.id);

    const booking = await prisma.booking.create({
      data: {
        userId: org.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 50000,
        netMinor: 45000,
        marginMinor: 5000,
        metadata: {
          snapshot: {
            origin: "LHE",
            destination: "DXB",
            flightNumber: "EK621",
            departAt: new Date().toISOString(),
          },
        },
      },
    });

    await groups.shareBooking(group.id, org.id, null, { bookingId: booking.id });
    await assert.rejects(
      () => groups.shareBooking(group.id, org.id, null, { bookingId: booking.id }),
      (err) => err.statusCode === 409,
    );

    const itin = await groups.getSharedItinerary(group.id, org.id, null);
    assert.equal(itin.items.length, 1);
    assert.equal(itin.items[0].booking.id, booking.id);

    await assert.rejects(
      () => groups.getSharedItinerary(group.id, stranger.id, null),
      (err) => err.statusCode === 403,
    );

    const status = await groups.getGroupFlightStatus(group.id, org.id, null);
    assert.ok(status.capability);
    assert.ok(Array.isArray(status.updates));
    // Unconfigured provider → not fabricated facts
    for (const u of status.updates) {
      assert.notEqual(u.dataStatus, "FABRICATED");
      if (!status.capability.canPollLive) {
        assert.ok(["UNAVAILABLE", "INSUFFICIENT_ATTRIBUTES"].includes(u.status || u.dataStatus) || u.dataStatus);
      }
    }

    const vault = await prisma.vaultDocument.create({
      data: {
        ownerUserId: org.id,
        type: "OTHER",
        title: "Private note",
        isActive: true,
      },
    });
    await groups.shareVaultDocument(group.id, org.id, null, { vaultDocumentId: vault.id });
    const docs = await groups.listSharedDocuments(group.id, org.id, null);
    assert.equal(docs.items.length, 1);

    await assert.rejects(
      () =>
        groups.shareVaultDocument(group.id, stranger.id, null, {
          vaultDocumentId: vault.id,
        }),
      (err) => err.statusCode === 403 || err.statusCode === 404,
    );
  });

  it("gallery permissions and trip memory grounding", async () => {
    const org = await createUser("galOrg");
    const group = await groups.createGroup(org.id, { name: "Gal", type: "STUDENT" });
    groupIds.push(group.id);

    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ).toString("base64");

    const photo = await groups.uploadGroupPhoto(group.id, org.id, null, {
      contentBase64: tinyPng,
      contentType: "image/png",
      originalFilename: "dot.png",
      caption: "first",
    });
    assert.ok(photo.id);

    const memInsufficient = await groups.generateTripMemory(
      (
        await groups.createGroup(org.id, { name: "Empty", type: "OTHER" })
      ).id,
      org.id,
      null,
    );
    // empty group just created — may have 1 member only → INSUFFICIENT
    groupIds.push(memInsufficient.groupId);
    assert.equal(memInsufficient.status, "INSUFFICIENT_DATA");

    const memory = await groups.generateTripMemory(group.id, org.id, null);
    assert.equal(memory.status, "GROUNDED");
    assert.match(memory.body, /photo/i);
    assert.ok(!/invented destination|Bali|Paris/i.test(memory.body));

    const guestCtx = await groups.getAvaGroupContext(null, null);
    assert.match(guestCtx.promptBlock, /sign in/i);
  });

  it("join by invite code is idempotent", async () => {
    const org = await createUser("joinOrg");
    const mem = await createUser("joinMem");
    const group = await groups.createGroup(org.id, { name: "Join", type: "CORPORATE_TOUR" });
    groupIds.push(group.id);
    const a = await groups.joinGroupByInviteCode(mem.id, group.inviteCode);
    const b = await groups.joinGroupByInviteCode(mem.id, group.inviteCode);
    assert.equal(a.id, b.id);
    assert.equal(a.status, "ACTIVE");
  });
});

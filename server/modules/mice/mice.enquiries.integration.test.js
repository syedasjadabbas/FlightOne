/**
 * Module 12 — MICE enquiry workflow tests.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.FLIGHTONE_API_LISTEN = "false";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");
const enquiries = await import("./mice.enquiries.js");

const suffix = Date.now();
const userIds = [];
const enquiryIds = [];
const eventIds = [];
const groupIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.miceenq.${label}.${suffix}@example.com`,
      name: `MiceEnq ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

function authHeader(user) {
  const token = signAccessToken({ sub: user.id, email: user.email });
  return { Authorization: `Bearer ${token}` };
}

function httpRequest(method, pathName, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
          method,
          headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json();
        resolve({ status: res.status, body: json });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

const starts = new Date(Date.now() + 86400000 * 10);
const ends = new Date(Date.now() + 86400000 * 12);

const validBody = {
  name: `Summit ${suffix}`,
  type: "CONFERENCE",
  organization: "Example Co",
  destination: "Dubai",
  origin: "Karachi",
  venue: "Hall A",
  eventStartsAt: starts.toISOString(),
  eventEndsAt: ends.toISOString(),
  attendeeCount: 40,
  budgetMinor: 1_000_000,
  currency: "USD",
  contactName: "Organizer",
  contactEmail: `org.${suffix}@example.com`,
  flightsRequired: true,
  hotelsRequired: true,
  notes: "Desk review only",
};

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of enquiryIds) {
    await prisma.miceEventEnquiry.delete({ where: { id } }).catch(() => {});
  }
  for (const id of eventIds) {
    await prisma.miceBudgetLine.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceSponsor.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceTransfer.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceBookingShare.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceCheckIn.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceSession.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceDelegate.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.miceEventEnquiry.deleteMany({ where: { eventId: id } }).catch(() => {});
    const ev = await prisma.miceEvent.findUnique({ where: { id }, select: { groupId: true } }).catch(() => null);
    if (ev?.groupId) groupIds.push(ev.groupId);
    await prisma.miceEvent.delete({ where: { id } }).catch(() => {});
  }
  for (const gid of [...new Set(groupIds)]) {
    await prisma.groupMember.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.travelGroup.delete({ where: { id: gid } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.miceEventEnquiry.deleteMany({ where: { createdByUserId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("MICE event enquiries", () => {
  it("rejects invalid attendee count and inverted dates", async () => {
    const user = await createUser("bad");
    await assert.rejects(
      () => enquiries.createMiceEnquiry(user.id, { ...validBody, attendeeCount: 0 }),
      (err) => err.statusCode === 400,
    );
    await assert.rejects(
      () =>
        enquiries.createMiceEnquiry(user.id, {
          ...validBody,
          eventStartsAt: ends.toISOString(),
          eventEndsAt: starts.toISOString(),
        }),
      (err) => err.statusCode === 400,
    );
  });

  it("creates, lists, retrieves, updates, cancels; isolates owners; idempotent", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const key = `idem-mice-${suffix}`;

    const created = await enquiries.createMiceEnquiry(owner.id, {
      ...validBody,
      idempotencyKey: key,
    });
    enquiryIds.push(created.id);
    if (created.eventId) eventIds.push(created.eventId);
    assert.equal(created.status, "SUBMITTED");
    assert.equal(created.fulfilment, "MANUAL_ASSISTED");
    assert.equal(created.attendeeCount, 40);

    const again = await enquiries.createMiceEnquiry(owner.id, {
      ...validBody,
      idempotencyKey: key,
    });
    assert.equal(again.id, created.id);

    const listed = await enquiries.listMyMiceEnquiries(owner.id);
    assert.ok(listed.items.some((r) => r.id === created.id));
    const otherList = await enquiries.listMyMiceEnquiries(other.id);
    assert.equal(otherList.items.some((r) => r.id === created.id), false);

    await assert.rejects(
      () => enquiries.getMiceEnquiry(other.id, created.id),
      (err) => err.statusCode === 404,
    );

    const patched = await enquiries.updateMiceEnquiry(owner.id, created.id, {
      notes: "Updated notes",
      attendeeCount: 45,
    });
    assert.equal(patched.notes, "Updated notes");
    assert.equal(patched.attendeeCount, 45);

    const cancelled = await enquiries.cancelMiceEnquiry(owner.id, created.id, {
      reason: "dates changed",
    });
    assert.equal(cancelled.status, "CANCELLED");
    await assert.rejects(
      () => enquiries.updateMiceEnquiry(owner.id, created.id, { notes: "nope" }),
      (err) => err.statusCode === 409,
    );
  });

  it("HTTP requires auth; validates input; owner-only detail", async () => {
    const unauth = await httpRequest("POST", "/api/v1/mice/enquiries", { body: validBody });
    assert.equal(unauth.status, 401);

    const owner = await createUser("httpOwner");
    const other = await createUser("httpOther");

    const invalid = await httpRequest("POST", "/api/v1/mice/enquiries", {
      headers: authHeader(owner),
      body: { ...validBody, attendeeCount: 0, destination: "x" },
    });
    assert.equal(invalid.status, 400);

    const created = await httpRequest("POST", "/api/v1/mice/enquiries", {
      headers: authHeader(owner),
      body: { ...validBody, name: `HTTP ${suffix}`, idempotencyKey: `http-mice-${suffix}` },
    });
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    enquiryIds.push(id);
    if (created.body.data.eventId) eventIds.push(created.body.data.eventId);

    const stolen = await httpRequest("GET", `/api/v1/mice/enquiries/${id}`, {
      headers: authHeader(other),
    });
    assert.equal(stolen.status, 404);

    const own = await httpRequest("GET", `/api/v1/mice/enquiries/${id}`, {
      headers: authHeader(owner),
    });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.status, "SUBMITTED");
  });
});

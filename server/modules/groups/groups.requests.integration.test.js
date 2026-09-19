/**
 * Module 11 — Group Travel request workflow tests.
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
const requests = await import("./groups.requests.js");
const { MIN_GROUP_PASSENGERS } = await import("./groups.constants.js");

const suffix = Date.now();
const userIds = [];
const requestIds = [];
const groupIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.grpreq.${label}.${suffix}@example.com`,
      name: `GrpReq ${label}`,
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

const validBody = {
  name: `Summit ${suffix}`,
  type: "CORPORATE_TOUR",
  origin: "KHI",
  destination: "DXB",
  departureDate: "2026-11-01",
  returnDate: "2026-11-08",
  flexibility: "PLUS_MINUS_1",
  passengerCount: 12,
  cabinPreference: "ECONOMY",
  purpose: "conference",
  contactName: "Organizer",
  contactEmail: `org.${suffix}@example.com`,
  contactPhone: "+923001234567",
  organization: "Example Co",
  baggageRequired: true,
  seatingTogether: true,
  airportTransfers: false,
  splitBilling: false,
  accommodationRequired: true,
  accommodationNotes: "Twin rooms preferred",
  notes: "Desk review only",
};

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of requestIds) {
    await prisma.groupTravelRequest.delete({ where: { id } }).catch(() => {});
  }
  for (const gid of groupIds) {
    await prisma.groupMember.deleteMany({ where: { groupId: gid } }).catch(() => {});
    await prisma.travelGroup.delete({ where: { id: gid } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.groupTravelRequest.deleteMany({ where: { createdByUserId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Group travel requests", () => {
  it("rejects under-minimum passenger count", async () => {
    const user = await createUser("small");
    await assert.rejects(
      () =>
        requests.createGroupTravelRequest(user.id, {
          ...validBody,
          passengerCount: MIN_GROUP_PASSENGERS - 1,
        }),
      (err) => err.statusCode === 400 || err.name === "ZodError",
    );
  });

  it("creates, lists, retrieves, updates, cancels; isolates owners; idempotent", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const key = `idem-grp-${suffix}`;

    const created = await requests.createGroupTravelRequest(owner.id, {
      ...validBody,
      idempotencyKey: key,
    });
    requestIds.push(created.id);
    if (created.groupId) groupIds.push(created.groupId);
    assert.equal(created.status, "SUBMITTED");
    assert.equal(created.passengerCount, 12);
    assert.equal(created.fulfilment, "MANUAL_ASSISTED");
    assert.equal(created.origin, "KHI");

    const again = await requests.createGroupTravelRequest(owner.id, {
      ...validBody,
      idempotencyKey: key,
    });
    assert.equal(again.id, created.id);

    const listed = await requests.listMyGroupTravelRequests(owner.id);
    assert.ok(listed.items.some((r) => r.id === created.id));
    const otherList = await requests.listMyGroupTravelRequests(other.id);
    assert.equal(otherList.items.some((r) => r.id === created.id), false);

    const detail = await requests.getGroupTravelRequest(owner.id, created.id);
    assert.equal(detail.id, created.id);
    await assert.rejects(
      () => requests.getGroupTravelRequest(other.id, created.id),
      (err) => err.statusCode === 404,
    );

    const patched = await requests.updateGroupTravelRequest(owner.id, created.id, {
      notes: "Updated notes",
      passengerCount: 14,
    });
    assert.equal(patched.notes, "Updated notes");
    assert.equal(patched.passengerCount, 14);

    const cancelled = await requests.cancelGroupTravelRequest(owner.id, created.id, {
      reason: "dates changed",
    });
    assert.equal(cancelled.status, "CANCELLED");
    const cancelledAgain = await requests.cancelGroupTravelRequest(owner.id, created.id);
    assert.equal(cancelledAgain.id, cancelled.id);

    await assert.rejects(
      () => requests.updateGroupTravelRequest(owner.id, created.id, { notes: "nope" }),
      (err) => err.statusCode === 409,
    );
  });

  it("HTTP requires auth; validates input; owner-only detail", async () => {
    const unauth = await httpRequest("POST", "/api/v1/groups/requests", { body: validBody });
    assert.equal(unauth.status, 401);

    const owner = await createUser("httpOwner");
    const other = await createUser("httpOther");

    const invalid = await httpRequest("POST", "/api/v1/groups/requests", {
      headers: authHeader(owner),
      body: { ...validBody, passengerCount: 2, origin: "1" },
    });
    assert.equal(invalid.status, 400);

    const created = await httpRequest("POST", "/api/v1/groups/requests", {
      headers: authHeader(owner),
      body: { ...validBody, name: `HTTP ${suffix}`, idempotencyKey: `http-${suffix}` },
    });
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    requestIds.push(id);
    if (created.body.data.groupId) groupIds.push(created.body.data.groupId);

    const stolen = await httpRequest("GET", `/api/v1/groups/requests/${id}`, {
      headers: authHeader(other),
    });
    assert.equal(stolen.status, 404);

    const own = await httpRequest("GET", `/api/v1/groups/requests/${id}`, {
      headers: authHeader(owner),
    });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.status, "SUBMITTED");
  });
});

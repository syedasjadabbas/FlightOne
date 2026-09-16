/**
 * Module 15 — Ops outbox worker delivery: claim lock, retries, idempotency, unconfigured.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.NODE_ENV = "test";
process.env.OPS_OUTBOX_MAX_ATTEMPTS = "3";
delete process.env.OPS_CRM_BASE_URL;
delete process.env.OPS_CRM_API_KEY;
delete process.env.OPS_MIDOFFICE_BASE_URL;
delete process.env.OPS_MIDOFFICE_API_KEY;
delete process.env.OPS_BACKOFFICE_BASE_URL;
delete process.env.OPS_BACKOFFICE_API_KEY;
delete process.env.OPS_ACCOUNTING_BASE_URL;
delete process.env.OPS_ACCOUNTING_API_KEY;

const { default: prisma } = await import("../../config/prisma.js");
const ops = await import("./operations.service.js");
const { isRetryableHttpStatus } = await import("./integrations/httpPush.js");

const suffix = Date.now();
const userIds = [];
const bookingIds = [];
const outboxIds = [];
const syncIds = [];
const accountingIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.opsdrain.${label}.${suffix}@example.com`,
      name: `OpsDrain ${label}`,
      passwordHash: await bcrypt.hash("Pass1234!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

async function createBooking(userId) {
  const booking = await prisma.booking.create({
    data: {
      userId,
      status: "TICKETED",
      product: "FLIGHT",
      currency: "USD",
      amountMinor: 10000,
      netMinor: 9000,
      marginMinor: 1000,
      supplierCode: "TP",
      externalRef: `PNR-${suffix}-${bookingIds.length}`,
    },
  });
  bookingIds.push(booking.id);
  return booking;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of outboxIds) {
    await prisma.opsExternalSync.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.opsOutboxEvent.delete({ where: { id } }).catch(() => {});
  }
  for (const id of accountingIds) {
    await prisma.accountingEntry.delete({ where: { id } }).catch(() => {});
  }
  for (const id of bookingIds) {
    await prisma.commissionRecord.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("ops outbox worker delivery", () => {
  it("classifies HTTP retryability", () => {
    assert.equal(isRetryableHttpStatus(500), true);
    assert.equal(isRetryableHttpStatus(429), true);
    assert.equal(isRetryableHttpStatus(400), false);
    assert.equal(isRetryableHttpStatus(404), false);
  });

  it("successful delivery when CRM configured (others unconfigured)", async () => {
    const user = await createUser("ok");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:drain:ok:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);

    process.env.OPS_CRM_BASE_URL = "https://crm.test";
    process.env.OPS_CRM_API_KEY = "test-key";
    let crmCalls = 0;
    const fetchImpl = async () => {
      crmCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "crm-ext-1" }),
        json: async () => ({ id: "crm-ext-1" }),
      };
    };

    try {
      const result = await ops.drainOutbox({
        eventId: evt.id,
        fetchImpl,
        actorUserId: user.id,
      });
      assert.equal(result.delivered, 1);
      assert.equal(crmCalls, 1);
      const updated = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
      assert.equal(updated.status, "DELIVERED");
      assert.equal(updated.deliveredAt != null, true);

      const syncs = await prisma.opsExternalSync.findMany({ where: { eventId: evt.id } });
      syncIds.push(...syncs.map((s) => s.id));
      assert.equal(syncs.find((s) => s.integration === "crm")?.status, "DELIVERED");
      assert.ok(
        syncs
          .filter((s) => s.integration !== "crm")
          .every((s) => s.status === "SKIPPED_UNCONFIGURED"),
      );
    } finally {
      delete process.env.OPS_CRM_BASE_URL;
      delete process.env.OPS_CRM_API_KEY;
    }
  });

  it("transient failure defers to PENDING for retry; permanent fails", async () => {
    const user = await createUser("retry");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:drain:retry:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);

    process.env.OPS_CRM_BASE_URL = "https://crm.test";
    process.env.OPS_CRM_API_KEY = "test-key";
    try {
      const transient = await ops.drainOutbox({
        eventId: evt.id,
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          text: async () => "{}",
          json: async () => ({}),
        }),
      });
      assert.equal(transient.deferred, 1);
      let row = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
      assert.equal(row.status, "PENDING");
      assert.ok(row.lastError);
      assert.ok(row.id); // persisted

      // Force permanent failure path via attempts exhaustion with 400s.
      await prisma.opsOutboxEvent.update({
        where: { id: evt.id },
        data: { attempts: 2 }, // next claim → 3 == max
      });
      const permanent = await ops.drainOutbox({
        eventId: evt.id,
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          text: async () => "{}",
          json: async () => ({}),
        }),
        env: { ...process.env, OPS_OUTBOX_MAX_ATTEMPTS: "3" },
      });
      assert.equal(permanent.failed, 1);
      row = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
      assert.equal(row.status, "FAILED");
      assert.ok(row.lastError);
    } finally {
      delete process.env.OPS_CRM_BASE_URL;
      delete process.env.OPS_CRM_API_KEY;
    }
  });

  it("duplicate concurrent claim: second drain gets zero claimed", async () => {
    const user = await createUser("lock");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:drain:lock:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);

    // Manually mark PROCESSING to simulate another worker holding the claim.
    await prisma.opsOutboxEvent.update({
      where: { id: evt.id },
      data: { status: "PROCESSING", processingStartedAt: new Date() },
    });

    const result = await ops.drainOutbox({ eventId: evt.id });
    assert.equal(result.claimed, 0);

    // Restore to PENDING for cleanup drain.
    await prisma.opsOutboxEvent.update({
      where: { id: evt.id },
      data: { status: "PENDING", processingStartedAt: null },
    });
  });

  it("idempotent re-drain skips already-delivered CRM push", async () => {
    const user = await createUser("idem");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:drain:idem:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);

    process.env.OPS_CRM_BASE_URL = "https://crm.test";
    process.env.OPS_CRM_API_KEY = "test-key";
    let crmCalls = 0;
    const fetchImpl = async () => {
      crmCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: `crm-${crmCalls}` }),
        json: async () => ({ id: `crm-${crmCalls}` }),
      };
    };

    try {
      await ops.drainOutbox({ eventId: evt.id, fetchImpl });
      assert.equal(crmCalls, 1);

      // Reset to PENDING without clearing DELIVERED sync — worker must skip CRM push.
      await prisma.opsOutboxEvent.update({
        where: { id: evt.id },
        data: {
          status: "PENDING",
          deliveredAt: null,
          processingStartedAt: null,
        },
      });

      await ops.drainOutbox({ eventId: evt.id, fetchImpl });
      assert.equal(crmCalls, 1); // no second external call

      const syncs = await prisma.opsExternalSync.findMany({ where: { eventId: evt.id } });
      syncIds.push(...syncs.map((s) => s.id));
      assert.equal(syncs.filter((s) => s.integration === "crm" && s.status === "DELIVERED").length, 1);
    } finally {
      delete process.env.OPS_CRM_BASE_URL;
      delete process.env.OPS_CRM_API_KEY;
    }
  });

  it("accounting + CRM unconfigured leave event SKIPPED_UNCONFIGURED; ledger still from enqueue", async () => {
    const user = await createUser("acct");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:drain:acct:${booking.id}`,
      payload: {
        bookingId: booking.id,
        amountMinor: booking.amountMinor,
        netMinor: booking.netMinor,
        currency: "USD",
      },
    });
    outboxIds.push(evt.id);

    const entries = await prisma.accountingEntry.findMany({ where: { bookingId: booking.id } });
    accountingIds.push(...entries.map((e) => e.id));
    assert.ok(entries.length >= 1);

    const beforeCount = entries.length;
    const result = await ops.drainOutbox({ eventId: evt.id });
    assert.equal(result.unconfigured, 1);
    const after = await prisma.accountingEntry.findMany({ where: { bookingId: booking.id } });
    assert.equal(after.length, beforeCount); // drain does not duplicate ledger

    const row = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
    assert.equal(row.status, "SKIPPED_UNCONFIGURED");
  });

  it("displayStatus maps pending retries; overview exposes unconfigured counts", async () => {
    assert.equal(ops.outboxDisplayStatus({ status: "PENDING", attempts: 0 }), "PENDING");
    assert.equal(ops.outboxDisplayStatus({ status: "PENDING", attempts: 2 }), "RETRYING");
    assert.equal(ops.outboxDisplayStatus({ status: "PROCESSING", attempts: 1 }), "PROCESSING");
    assert.equal(
      ops.outboxDisplayStatus({ status: "SKIPPED_UNCONFIGURED", attempts: 1 }),
      "SKIPPED_UNCONFIGURED",
    );

    const overview = await ops.getOperationsOverview();
    assert.equal(typeof overview.outbox.unconfigured, "number");
    assert.equal(typeof overview.outbox.processing, "number");
    assert.equal(typeof overview.outbox.retrying, "number");
  });
});

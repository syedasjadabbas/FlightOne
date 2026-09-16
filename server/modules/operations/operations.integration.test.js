/**
 * Module 15 — Operations Platform integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

// Ensure external adapters stay unconfigured during tests unless explicitly set per-case.
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
const { getCrmCapability, pushCrmEvent } = await import("./integrations/crm/crm.adapter.js");

const suffix = Date.now();
const userIds = [];
const bookingIds = [];
const outboxIds = [];
const accountingIds = [];
const commissionIds = [];
const reconIds = [];
const syncIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.ops.${label}.${suffix}@example.com`,
      name: `Ops ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

async function createBooking(userId, overrides = {}) {
  const booking = await prisma.booking.create({
    data: {
      userId,
      product: "FLIGHT",
      status: overrides.status || "TICKETED",
      currency: overrides.currency || "USD",
      amountMinor: overrides.amountMinor ?? 10000,
      netMinor: overrides.netMinor ?? 9000,
      marginMinor: overrides.marginMinor ?? 1000,
      supplierCode: overrides.supplierCode || "GALILEO",
      externalRef: overrides.externalRef || `EXT-${suffix}`,
      metadata: overrides.metadata ?? {},
    },
  });
  bookingIds.push(booking.id);
  return booking;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of syncIds) {
    await prisma.opsExternalSync.delete({ where: { id } }).catch(() => {});
  }
  for (const id of reconIds) {
    await prisma.supplierReconItem.delete({ where: { id } }).catch(() => {});
  }
  for (const id of commissionIds) {
    await prisma.commissionRecord.delete({ where: { id } }).catch(() => {});
  }
  for (const id of accountingIds) {
    await prisma.accountingEntry.delete({ where: { id } }).catch(() => {});
  }
  // Also clean by booking
  for (const bid of bookingIds) {
    await prisma.opsExternalSync.deleteMany({ where: { eventId: { not: "" } } }).catch(() => {});
    await prisma.accountingEntry.deleteMany({ where: { bookingId: bid } }).catch(() => {});
    await prisma.commissionRecord.deleteMany({ where: { bookingId: bid } }).catch(() => {});
    await prisma.supplierReconItem.deleteMany({ where: { bookingId: bid } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { bookingId: bid } }).catch(() => {});
    await prisma.bookingTransition.deleteMany({ where: { bookingId: bid } }).catch(() => {});
    await prisma.booking.delete({ where: { id: bid } }).catch(() => {});
  }
  for (const id of outboxIds) {
    await prisma.opsExternalSync.deleteMany({ where: { eventId: id } }).catch(() => {});
    await prisma.opsOutboxEvent.delete({ where: { id } }).catch(() => {});
  }
  await prisma.opsOutboxEvent
    .deleteMany({ where: { aggregateId: { in: bookingIds } } })
    .catch(() => {});
  await prisma.opsOutboxEvent
    .deleteMany({ where: { type: "CUSTOMER_UPSERTED", aggregateId: { in: userIds } } })
    .catch(() => {});
  for (const id of userIds) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.travellerProfile.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.companyMembership.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 15 Operations Platform", () => {
  it("CRM unconfigured — push never claims success", async () => {
    const cap = getCrmCapability();
    assert.equal(cap.state, "UNCONFIGURED");
    const r = await pushCrmEvent({
      id: "test-evt",
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: "x",
      payload: {},
      createdAt: new Date(),
    });
    assert.equal(r.status, "SKIPPED_UNCONFIGURED");
  });

  it("enqueue BOOKING_TICKETED creates accounting + idempotent re-enqueue", async () => {
    const user = await createUser("tkt");
    const booking = await createBooking(user.id);
    const key = `ops:test:ticketed:${booking.id}`;
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: key,
      payload: {
        bookingId: booking.id,
        amountMinor: booking.amountMinor,
        netMinor: booking.netMinor,
        currency: booking.currency,
      },
    });
    outboxIds.push(evt.id);
    assert.equal(evt.deduplicated, false);

    const entries = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id },
    });
    accountingIds.push(...entries.map((e) => e.id));
    assert.ok(entries.some((e) => e.entryType === "REVENUE"));
    assert.ok(entries.some((e) => e.entryType === "COST"));
    assert.ok(entries.some((e) => e.entryType === "MARGIN"));
    assert.equal(entries.find((e) => e.entryType === "MARGIN")?.amountMinor, 1000);

    const again = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: key,
      payload: {
        bookingId: booking.id,
        amountMinor: booking.amountMinor,
        netMinor: booking.netMinor,
        currency: booking.currency,
      },
    });
    assert.equal(again.deduplicated, true);
    assert.equal(again.id, evt.id);
  });

  it("commission DATA_UNAVAILABLE without config; records when BPS set", async () => {
    const prev = process.env.OPS_COMMISSION_BPS;
    delete process.env.OPS_COMMISSION_BPS;
    const user = await createUser("comm");
    const booking = await createBooking(user.id);
    const noCfg = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:test:comm:none:${booking.id}`,
      payload: {
        bookingId: booking.id,
        amountMinor: 10000,
        netMinor: 9000,
        currency: "USD",
      },
    });
    outboxIds.push(noCfg.id);
    const none = await prisma.commissionRecord.findMany({ where: { bookingId: booking.id } });
    assert.equal(none.length, 0);

    process.env.OPS_COMMISSION_BPS = "500";
    const booking2 = await createBooking(user.id);
    const withCfg = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking2.id,
      idempotencyKey: `ops:test:comm:yes:${booking2.id}`,
      payload: {
        bookingId: booking2.id,
        amountMinor: 10000,
        netMinor: 9000,
        currency: "USD",
      },
    });
    outboxIds.push(withCfg.id);
    const rows = await prisma.commissionRecord.findMany({ where: { bookingId: booking2.id } });
    commissionIds.push(...rows.map((r) => r.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].commissionBps, 500);
    assert.equal(rows[0].commissionMinor, 500);

    // idempotent commission
    await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking2.id,
      idempotencyKey: `ops:test:comm:yes2:${booking2.id}`,
      payload: {
        bookingId: booking2.id,
        amountMinor: 10000,
        netMinor: 9000,
        currency: "USD",
      },
    }).then((e) => outboxIds.push(e.id));
    const again = await prisma.commissionRecord.findMany({ where: { bookingId: booking2.id } });
    assert.equal(again.length, 1);

    if (prev === undefined) delete process.env.OPS_COMMISSION_BPS;
    else process.env.OPS_COMMISSION_BPS = prev;
  });

  it("reconciliation MATCHED / MISMATCH / DATA_UNAVAILABLE + idempotency", async () => {
    const user = await createUser("recon");
    const booking = await createBooking(user.id, { netMinor: 9000, externalRef: "PNR-A" });

    const unavailable = await ops.createReconciliationItem({
      bookingId: booking.id,
      actorUserId: user.id,
      idempotencyKey: `recon:test:na:${booking.id}`,
    });
    reconIds.push(unavailable.id);
    assert.equal(unavailable.status, "DATA_UNAVAILABLE");

    const matched = await ops.createReconciliationItem({
      bookingId: booking.id,
      invoicedMinor: 9000,
      actorUserId: user.id,
      idempotencyKey: `recon:test:ok:${booking.id}`,
    });
    reconIds.push(matched.id);
    assert.equal(matched.status, "MATCHED");

    const mismatch = await ops.createReconciliationItem({
      bookingId: booking.id,
      invoicedMinor: 8000,
      actorUserId: user.id,
      idempotencyKey: `recon:test:bad:${booking.id}`,
    });
    reconIds.push(mismatch.id);
    assert.equal(mismatch.status, "MISMATCH");

    const dup = await ops.createReconciliationItem({
      bookingId: booking.id,
      invoicedMinor: 9000,
      idempotencyKey: `recon:test:ok:${booking.id}`,
    });
    assert.equal(dup.deduplicated, true);
  });

  it("drain outbox with unconfigured externals marks SKIPPED_UNCONFIGURED (not delivered)", async () => {
    const user = await createUser("drain");
    const booking = await createBooking(user.id);
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_CREATED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:test:drain:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);
    assert.equal(evt.status, "PENDING");

    const result = await ops.drainOutbox({ eventId: evt.id, actorUserId: user.id });
    assert.equal(result.unconfigured >= 1, true);
    assert.equal(result.delivered, 0);
    const updated = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
    assert.equal(updated.status, "SKIPPED_UNCONFIGURED");
    assert.ok(String(updated.lastError || "").includes("UNCONFIGURED"));
    // Event remains persisted — not discarded.
    assert.ok(updated.id);

    const syncs = await prisma.opsExternalSync.findMany({ where: { eventId: evt.id } });
    syncIds.push(...syncs.map((s) => s.id));
    assert.ok(syncs.length >= 1);
    assert.ok(syncs.every((s) => s.status === "SKIPPED_UNCONFIGURED"));
  });

  it("integration status surfaces UNCONFIGURED CRM", async () => {
    const status = await ops.getIntegrationStatus();
    assert.equal(status.crm.state, "UNCONFIGURED");
    assert.equal(status.midoffice.state, "UNCONFIGURED");
    assert.equal(status.backoffice.state, "UNCONFIGURED");
    assert.equal(status.accounting.state, "UNCONFIGURED");
    assert.equal(status.finance.configured, true);
  });

  it("Ava guidance never invents external success; IDOR-safe booking scope", async () => {
    const owner = await createUser("ava-o");
    const other = await createUser("ava-x");
    const booking = await createBooking(owner.id);
    const g = await ops.buildAvaOperationsGuidance(owner.id, booking.id);
    assert.ok(g.promptBlock.includes("UNCONFIGURED") || g.promptBlock.includes("CRM="));
    assert.ok(g.promptBlock.includes("never claim") || g.promptBlock.includes("never invent") || g.promptBlock.includes("Customer-facing"));

    const denied = await ops.buildAvaOperationsGuidance(other.id, booking.id);
    assert.ok(denied.promptBlock.includes("not found") || denied.promptBlock.includes("never invent"));
  });

  it("overview returns counts", async () => {
    const overview = await ops.getOperationsOverview();
    assert.ok(overview.outbox);
    assert.ok(overview.integrations);
  });

  it("BOOKING_REFUNDED creates REFUND accounting entry idempotently", async () => {
    const user = await createUser("rfd");
    const booking = await createBooking(user.id);
    const key = `ops:test:refunded:${booking.id}`;
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_REFUNDED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: key,
      payload: { bookingId: booking.id, amountMinor: 5000, currency: "USD" },
    });
    outboxIds.push(evt.id);
    const entries = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "REFUND" },
    });
    accountingIds.push(...entries.map((e) => e.id));
    assert.equal(entries.length, 1);

    await ops.enqueueOpsEvent({
      type: "BOOKING_REFUNDED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: key,
      payload: { bookingId: booking.id, amountMinor: 5000, currency: "USD" },
    });
    const again = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "REFUND" },
    });
    assert.equal(again.length, 1);
  });

  it("forged payload amounts cannot alter accounting or commission truth", async () => {
    const prev = process.env.OPS_COMMISSION_BPS;
    process.env.OPS_COMMISSION_BPS = "1000";
    const user = await createUser("forge");
    const booking = await createBooking(user.id, {
      amountMinor: 20000,
      netMinor: 15000,
      marginMinor: 5000,
      currency: "EUR",
    });
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:test:forge:${booking.id}`,
      payload: {
        bookingId: booking.id,
        amountMinor: 1,
        netMinor: 1,
        currency: "USD",
      },
    });
    outboxIds.push(evt.id);

    const entries = await prisma.accountingEntry.findMany({ where: { bookingId: booking.id } });
    accountingIds.push(...entries.map((e) => e.id));
    assert.equal(entries.find((e) => e.entryType === "REVENUE")?.amountMinor, 20000);
    assert.equal(entries.find((e) => e.entryType === "COST")?.amountMinor, 15000);
    assert.equal(entries.find((e) => e.entryType === "MARGIN")?.amountMinor, 5000);
    assert.equal(entries.find((e) => e.entryType === "REVENUE")?.currency, "EUR");

    const commissions = await prisma.commissionRecord.findMany({ where: { bookingId: booking.id } });
    commissionIds.push(...commissions.map((c) => c.id));
    assert.equal(commissions.length, 1);
    assert.equal(commissions[0].basisMinor, 20000);
    assert.equal(commissions[0].commissionMinor, 2000);
    assert.equal(commissions[0].currency, "EUR");

    if (prev === undefined) delete process.env.OPS_COMMISSION_BPS;
    else process.env.OPS_COMMISSION_BPS = prev;
  });

  it("PAYMENT_CAPTURED creates finance PAYMENT entry idempotently from Payment row", async () => {
    const user = await createUser("pay");
    const booking = await createBooking(user.id, { status: "QUOTED", amountMinor: 7777 });
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        status: "CAPTURED",
        provider: "SIMULATED",
        currency: "USD",
        amountMinor: 7777,
        providerPaymentId: `sim_${booking.id}`,
        idempotencyKey: `pay-test-${booking.id}`,
      },
    });
    const key = `ops:test:pay:${payment.id}`;
    const evt = await ops.enqueueOpsEvent({
      type: "PAYMENT_CAPTURED",
      aggregateType: "Payment",
      aggregateId: payment.id,
      idempotencyKey: key,
      payload: {
        paymentId: payment.id,
        bookingId: booking.id,
        amountMinor: 1, // forged — ignored
        currency: "GBP",
      },
    });
    outboxIds.push(evt.id);

    const entries = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "PAYMENT" },
    });
    accountingIds.push(...entries.map((e) => e.id));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].amountMinor, 7777);
    assert.equal(entries[0].currency, "USD");
    assert.equal(entries[0].paymentId, payment.id);

    await ops.enqueueOpsEvent({
      type: "PAYMENT_CAPTURED",
      aggregateType: "Payment",
      aggregateId: payment.id,
      idempotencyKey: key,
      payload: { paymentId: payment.id, bookingId: booking.id },
    });
    const again = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "PAYMENT" },
    });
    assert.equal(again.length, 1);
  });

  it("company isolation filters accounting/commission; currency preserved", async () => {
    const prev = process.env.OPS_COMMISSION_BPS;
    process.env.OPS_COMMISSION_BPS = "250";
    const user = await createUser("co");
    const a = await createBooking(user.id, {
      metadata: { companyId: `co-a-${suffix}` },
      amountMinor: 10000,
      currency: "USD",
    });
    const b = await createBooking(user.id, {
      metadata: { companyId: `co-b-${suffix}` },
      amountMinor: 8000,
      currency: "GBP",
    });

    for (const booking of [a, b]) {
      const evt = await ops.enqueueOpsEvent({
        type: "BOOKING_TICKETED",
        aggregateType: "Booking",
        aggregateId: booking.id,
        idempotencyKey: `ops:test:co:${booking.id}`,
        payload: { bookingId: booking.id },
      });
      outboxIds.push(evt.id);
    }

    const listA = await ops.listAccounting({ companyId: `co-a-${suffix}` });
    assert.ok(listA.items.every((e) => e.companyId === `co-a-${suffix}`));
    assert.ok(listA.items.some((e) => e.bookingId === a.id));
    assert.ok(!listA.items.some((e) => e.bookingId === b.id));

    const commA = await ops.listCommissions({ companyId: `co-a-${suffix}` });
    commissionIds.push(...(await prisma.commissionRecord.findMany({ where: { bookingId: a.id } })).map((r) => r.id));
    commissionIds.push(...(await prisma.commissionRecord.findMany({ where: { bookingId: b.id } })).map((r) => r.id));
    accountingIds.push(
      ...(await prisma.accountingEntry.findMany({ where: { bookingId: { in: [a.id, b.id] } } })).map(
        (e) => e.id,
      ),
    );
    assert.equal(commA.items.length, 1);
    assert.equal(commA.items[0].bookingId, a.id);
    assert.equal(commA.items[0].currency, "USD");
    assert.equal(commA.items[0].supplierCode, "GALILEO");

    const finance = await ops.getFinanceSnapshot({ companyId: `co-a-${suffix}` });
    assert.equal(finance.externalAccounting.syncStatus, "UNCONFIGURED");
    assert.equal(finance.externalAccounting.dataAvailability, "DATA_UNAVAILABLE");
    assert.ok(finance.aggregates.accounting.some((row) => row.currency === "USD"));

    if (prev === undefined) delete process.env.OPS_COMMISSION_BPS;
    else process.env.OPS_COMMISSION_BPS = prev;
  });

  it("SQL aggregates for accounting reporting", async () => {
    const user = await createUser("agg");
    const booking = await createBooking(user.id, { amountMinor: 5000, netMinor: 4000, marginMinor: 1000 });
    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_TICKETED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:test:agg:${booking.id}`,
      payload: { bookingId: booking.id },
    });
    outboxIds.push(evt.id);
    accountingIds.push(
      ...(await prisma.accountingEntry.findMany({ where: { bookingId: booking.id } })).map((e) => e.id),
    );

    const listed = await ops.listAccounting({ bookingId: booking.id });
    assert.ok(listed.aggregates?.length >= 2);
    const revenue = listed.aggregates.find((r) => r.entryType === "REVENUE");
    assert.equal(revenue?.amountMinorSum, 5000);
    assert.equal(revenue?.currency, "USD");
  });

  it("refund with calculation uses authoritative refundableMinor + credit", async () => {
    const user = await createUser("rfdcalc");
    const booking = await createBooking(user.id);
    const calc = await prisma.refundCalculation.create({
      data: {
        bookingId: booking.id,
        currency: "USD",
        grossPaidMinor: 10000,
        supplierPenaltyMinor: 2000,
        agencyFeeMinor: 0,
        refundableMinor: 8000,
        travelCreditMinor: 500,
        createdByUserId: user.id,
        formula: { test: true },
      },
    });
    const refundCase = await prisma.refundCase.create({
      data: {
        bookingId: booking.id,
        calculationId: calc.id,
        status: "COMPLETED",
        kind: "REFUND",
        createdByUserId: user.id,
        idempotencyKey: `rc-test-${booking.id}`,
      },
    });

    const evt = await ops.enqueueOpsEvent({
      type: "BOOKING_REFUNDED",
      aggregateType: "Booking",
      aggregateId: booking.id,
      idempotencyKey: `ops:test:rfdcalc:${booking.id}`,
      payload: {
        bookingId: booking.id,
        refundCaseId: refundCase.id,
        amountMinor: 1,
        currency: "GBP",
      },
    });
    outboxIds.push(evt.id);

    const refunds = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "REFUND" },
    });
    const credits = await prisma.accountingEntry.findMany({
      where: { bookingId: booking.id, entryType: "CREDIT" },
    });
    accountingIds.push(...refunds.map((e) => e.id), ...credits.map((e) => e.id));
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].amountMinor, 8000);
    assert.equal(refunds[0].currency, "USD");
    assert.equal(credits.length, 1);
    assert.equal(credits[0].amountMinor, 500);

    await prisma.refundCase.delete({ where: { id: refundCase.id } }).catch(() => {});
    await prisma.refundCalculation.delete({ where: { id: calc.id } }).catch(() => {});
  });
});

describe("Module 15 CUSTOMER_UPSERTED producer", () => {
  it("registration creates CUSTOMER_UPSERTED with safe payload; idempotent on retry", async () => {
    const auth = await import("../auth/auth.service.js");
    const email = `fo.ops.cust.reg.${suffix}@example.com`;
    const session = await auth.registerUser({
      email,
      password: "TestPass123!",
      name: "Ops Customer",
    });
    const userId = session.user.id;
    userIds.push(userId);

    const events = await prisma.opsOutboxEvent.findMany({
      where: { type: "CUSTOMER_UPSERTED", aggregateId: userId },
    });
    outboxIds.push(...events.map((e) => e.id));
    assert.equal(events.length, 1);
    assert.equal(events[0].aggregateType, "User");
    assert.equal(events[0].idempotencyKey, `ops:customer:upserted:register:${userId}`);
    assert.equal(events[0].payload.userId, userId);
    assert.equal(events[0].payload.email, email);
    assert.equal(events[0].payload.name, "Ops Customer");
    assert.equal(events[0].payload.source, "auth.register");
    assert.deepEqual(events[0].payload.companyIds, []);
    const json = JSON.stringify(events[0].payload);
    assert.equal(json.includes("password"), false);
    assert.equal(json.includes("passwordHash"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(events[0].payload, "metadata"), false);

    const {
      enqueueCustomerUpserted,
      CUSTOMER_UPSERT_SOURCES,
    } = await import("./integrations/crm/customerUpsert.producer.js");
    const again = await enqueueCustomerUpserted({
      userId,
      source: CUSTOMER_UPSERT_SOURCES.REGISTER,
    });
    assert.equal(again.deduplicated, true);
    assert.equal(again.id, events[0].id);

    const count = await prisma.opsOutboxEvent.count({
      where: { type: "CUSTOMER_UPSERTED", aggregateId: userId },
    });
    assert.equal(count, 1);
  });

  it("profile update creates CUSTOMER_UPSERTED; duplicate identical update dedupes", async () => {
    const user = await createUser("prof");
    const profile = await import("../profile/profile.service.js");
    await profile.updateProfile(user.id, {
      displayName: "First Name",
      phone: "+19998887777",
      nationality: "PK",
    });

    const events = await prisma.opsOutboxEvent.findMany({
      where: {
        type: "CUSTOMER_UPSERTED",
        aggregateId: user.id,
        payload: { path: ["source"], equals: "profile.update" },
      },
    });
    outboxIds.push(...events.map((e) => e.id));
    assert.ok(events.length >= 1);
    const first = events[0];
    assert.equal(first.payload.displayName, "First Name");
    assert.equal(first.payload.phone, "+19998887777");
    assert.equal(first.payload.nationality, "PK");
    assert.equal(first.payload.userId, user.id);

    // Same material values again → content-hash idempotency
    await profile.updateProfile(user.id, {
      displayName: "First Name",
      phone: "+19998887777",
      nationality: "PK",
    });
    const afterSame = await prisma.opsOutboxEvent.count({
      where: {
        type: "CUSTOMER_UPSERTED",
        aggregateId: user.id,
        payload: { path: ["source"], equals: "profile.update" },
      },
    });
    assert.equal(afterSame, events.length);

    // Material change → new event
    await profile.updateProfile(user.id, { phone: "+18887776666" });
    const afterChange = await prisma.opsOutboxEvent.findMany({
      where: {
        type: "CUSTOMER_UPSERTED",
        aggregateId: user.id,
        payload: { path: ["source"], equals: "profile.update" },
      },
      orderBy: { createdAt: "asc" },
    });
    outboxIds.push(...afterChange.map((e) => e.id));
    assert.ok(afterChange.length > events.length);
    assert.equal(afterChange.at(-1).payload.phone, "+18887776666");
  });

  it("company membership appears in payload; other companies excluded", async () => {
    const tag = Math.random().toString(16).slice(2, 10);
    const user = await createUser(`crmco-${tag}`);
    const other = await createUser(`crmco-oth-${tag}`);
    const company = await prisma.company.create({
      data: {
        name: `CRM Co ${suffix}-${tag}`,
        creditLimitMinor: 100000,
        currency: "USD",
      },
    });
    const foreign = await prisma.company.create({
      data: {
        name: `CRM Foreign ${suffix}-${tag}`,
        creditLimitMinor: 100000,
        currency: "USD",
      },
    });
    await prisma.companyMembership.create({
      data: { companyId: company.id, userId: user.id, role: "MEMBER" },
    });
    await prisma.companyMembership.create({
      data: { companyId: foreign.id, userId: other.id, role: "MEMBER" },
    });

    const { enqueueCustomerUpserted, CUSTOMER_UPSERT_SOURCES } = await import(
      "./integrations/crm/customerUpsert.producer.js"
    );
    const evt = await enqueueCustomerUpserted({
      userId: user.id,
      source: CUSTOMER_UPSERT_SOURCES.PROFILE_UPDATE,
    });
    outboxIds.push(evt.id);
    assert.deepEqual(evt.payload.companyIds, [company.id]);
    assert.equal(evt.payload.companyIds.includes(foreign.id), false);

    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [company.id, foreign.id] } },
    }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [company.id, foreign.id] } } }).catch(() => {});
  });

  it("CRM unconfigured drain leaves CUSTOMER_UPSERTED as SKIPPED_UNCONFIGURED", async () => {
    delete process.env.OPS_CRM_BASE_URL;
    delete process.env.OPS_CRM_API_KEY;
    const user = await createUser("skip");
    const { enqueueCustomerUpserted, CUSTOMER_UPSERT_SOURCES } = await import(
      "./integrations/crm/customerUpsert.producer.js"
    );
    const evt = await enqueueCustomerUpserted({
      userId: user.id,
      source: CUSTOMER_UPSERT_SOURCES.REGISTER,
      idempotencySuffix: `ops:customer:upserted:test-skip:${user.id}`,
    });
    outboxIds.push(evt.id);
    assert.equal(evt.status, "PENDING");

    const drained = await ops.drainOutbox({ eventId: evt.id, actorUserId: user.id });
    assert.ok(drained.unconfigured >= 1 || drained.claimed >= 1);
    const updated = await prisma.opsOutboxEvent.findUnique({ where: { id: evt.id } });
    assert.equal(updated.status, "SKIPPED_UNCONFIGURED");
    const syncs = await prisma.opsExternalSync.findMany({ where: { eventId: evt.id } });
    syncIds.push(...syncs.map((s) => s.id));
    assert.ok(syncs.every((s) => s.status === "SKIPPED_UNCONFIGURED"));
  });

  it("isolation: customer A upsert events never use customer B aggregateId", async () => {
    const a = await createUser("iso-a");
    const b = await createUser("iso-b");
    const { enqueueCustomerUpserted, CUSTOMER_UPSERT_SOURCES } = await import(
      "./integrations/crm/customerUpsert.producer.js"
    );
    const evtA = await enqueueCustomerUpserted({
      userId: a.id,
      source: CUSTOMER_UPSERT_SOURCES.REGISTER,
      idempotencySuffix: `ops:customer:upserted:iso-a:${a.id}`,
    });
    const evtB = await enqueueCustomerUpserted({
      userId: b.id,
      source: CUSTOMER_UPSERT_SOURCES.REGISTER,
      idempotencySuffix: `ops:customer:upserted:iso-b:${b.id}`,
    });
    outboxIds.push(evtA.id, evtB.id);
    assert.equal(evtA.aggregateId, a.id);
    assert.equal(evtB.aggregateId, b.id);
    assert.equal(evtA.payload.userId, a.id);
    assert.equal(evtB.payload.userId, b.id);
    assert.notEqual(evtA.payload.email, evtB.payload.email);
  });
});

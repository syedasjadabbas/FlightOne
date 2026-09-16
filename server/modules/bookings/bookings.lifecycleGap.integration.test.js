/**
 * Targeted integration test suite covering the full booking lifecycle gap:
 * RESERVED → PENDING_APPROVAL / PENDING_PAYMENT → PAID → TICKETED / CONFIRMED.
 *
 * Verifies:
 * 1. RESERVED booking under corporate policy requires approval (PENDING_APPROVAL)
 * 2. Approving request unblocks payment
 * 3. Paying a RESERVED booking captures payment (PAID)
 * 4. Payment capture triggers supplier ticketing (TICKETED / CONFIRMED)
 * 5. Ticket numbers stored, VaultDocument filed, NotificationOutbox enqueued
 * 6. Booking failure never transitions to PAID or TICKETED
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.ALLOW_SIMULATED_PAYMENT = "true";
process.env.ALLOW_SIMULATED_BOOKING = "true";

const { default: prisma } = await import("../../config/prisma.js");
const bookingsService = await import("./bookings.service.js");
const paymentsService = await import("../payments/payments.service.js");
const corporateService = await import("../corporate/corporate.service.js");
const {
  setReserveSupplierInventoryOverrideForTests,
  setTicketSupplierInventoryOverrideForTests,
} = await import("../suppliers/supplierBooking.js");

const suffix = Date.now();
const users = [];
const companies = [];
const bookingIds = [];

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  setReserveSupplierInventoryOverrideForTests(null);
  setTicketSupplierInventoryOverrideForTests(null);

  for (const id of bookingIds) {
    await prisma.notificationOutbox.deleteMany({ where: { dedupeKey: { contains: id } } }).catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.bookingTransition.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.approvalRequest.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id: id } }).catch(() => {});
  }
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  for (const id of companies) {
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function createUser(tag) {
  const user = await prisma.user.create({
    data: {
      email: `life.gap.${tag}.${suffix}@example.com`,
      name: `User ${tag}`,
      passwordHash: await bcrypt.hash("Pass1234!", 10),
    },
  });
  users.push(user.id);
  return user;
}

const mockRefs = {
  transactionId: "t-snap-1",
  combinabilityCode: "C1",
  productRef: "p-1",
  brandRef: "b-1",
  flightRefs: ["f-1"],
  returnFlightRefs: null,
  contentSource: "GDS",
};

async function createSupplierSnapshot({ userId, netMinor = 10000 }) {
  return prisma.supplierOfferSnapshot.create({
    data: {
      userId,
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-10000",
      product: "FLIGHT",
      currency: "USD",
      netMinor,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ttlMs: 3600000,
      supplierBookingRefs: mockRefs,
    },
  });
}

async function createReservedBooking(user, extra = {}) {
  const snapshot = await createSupplierSnapshot({
    userId: user.id,
    netMinor: extra.netMinor ?? 10000,
  });
  const quote = await bookingsService.createQuote(user.id, {
    product: "FLIGHT",
    currency: "USD",
    supplierOfferSnapshotId: snapshot.id,
    route: extra.route ?? "LHE-DXB",
    cabin: "ECONOMY",
    metadata: extra.metadata,
  });
  bookingIds.push(quote.id);

  // Promote to RESERVED with hold
  const reserved = await prisma.booking.update({
    where: { id: quote.id },
    data: {
      status: "RESERVED",
      externalRef: extra.externalRef ?? "PNRHOLD1",
      reservedUntil: new Date(Date.now() + 30 * 60 * 1000),
      travellerSnapshot: { givenName: "Ada", surname: "Lovelace" },
    },
  });
  return reserved;
}

describe("Booking Lifecycle Gap: RESERVED → APPROVAL / PAYMENT → PAID → TICKETED", () => {
  it("RESERVED booking can be paid directly, transitioning PENDING_PAYMENT → PAID", async () => {
    const user = await createUser("pay-reserved");
    const booking = await createReservedBooking(user);

    // Initial state: payments is empty (PENDING_PAYMENT)
    const initial = await bookingsService.getBookingById(user.id, booking.id);
    assert.equal(initial.status, "RESERVED");
    assert.deepEqual(initial.payments, []);

    // Perform payment on the RESERVED booking
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
      idempotencyKey: `pay-res-${suffix}`,
    });

    assert.equal(pay.status, "CAPTURED");
    assert.equal(pay.bookingId, booking.id);

    // getBookingById now exposes the captured payment
    const updated = await bookingsService.getBookingById(user.id, booking.id);
    assert.equal(updated.payments.length, 1);
    assert.equal(updated.payments[0].status, "CAPTURED");
  });

  it("successful payment on RESERVED booking triggers supplier ticketing, filing Vault document & confirmation", async () => {
    const user = await createUser("pay-tickets");
    const booking = await createReservedBooking(user, { externalRef: "PNRLIVE1" });

    // Mock supplier ticketing returning real ticket numbers
    setTicketSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNRLIVE1",
      ticketNumbers: ["0019998887771"],
      details: { source: "travelport-workbench-test" },
    }));

    try {
      const pay = await paymentsService.payBooking(user.id, booking.id, {
        paymentMethodToken: "pm_test_ok",
        idempotencyKey: `pay-tkt-${suffix}`,
      });
      assert.equal(pay.status, "CAPTURED");

      // Verify booking has transitioned to TICKETED (or promoted to ACTIVE by JourneyWatch)
      const ticketed = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.ok(["TICKETED", "ACTIVE"].includes(ticketed.status));
      assert.equal(ticketed.reservedUntil, null);
      assert.deepEqual(ticketed.metadata?.supplierBooking?.ticket?.ticketNumbers, [
        "0019998887771",
      ]);

      // Verify VaultDocument of type TICKET was generated
      const vault = await prisma.vaultDocument.findFirst({
        where: { bookingId: booking.id, type: "TICKET" },
      });
      assert.ok(vault, "VaultDocument TICKET should be auto-ingested");
      assert.deepEqual(vault.fileMeta?.ticketNumbers, ["0019998887771"]);

      // Verify confirmation notifications were enqueued in NotificationOutbox
      const notifications = await prisma.notificationOutbox.findMany({
        where: { dedupeKey: { contains: booking.id } },
      });
      assert.ok(notifications.length >= 2, "Should enqueue APP and EMAIL notifications");
      const channels = notifications.map((n) => n.channel);
      assert.ok(channels.includes("APP"));
      assert.ok(channels.includes("EMAIL"));
    } finally {
      setTicketSupplierInventoryOverrideForTests(null);
    }
  });

  it("supplier ticketing failure leaves booking RESERVED without fabricating tickets", async () => {
    const user = await createUser("pay-fail-ticket");
    const booking = await createReservedBooking(user, { externalRef: "PNRFAIL2" });

    setTicketSupplierInventoryOverrideForTests(() => ({
      status: "failed",
      details: { reason: "GDS workbench unavailable" },
    }));

    try {
      const pay = await paymentsService.payBooking(user.id, booking.id, {
        paymentMethodToken: "pm_test_ok",
      });
      assert.equal(pay.status, "CAPTURED");

      // Booking must remain RESERVED so it can be serviced/retried
      const current = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(current.status, "RESERVED");
      assert.equal(current.ticketAttemptId, null);

      // No fake vault ticket document created
      const vault = await prisma.vaultDocument.findFirst({
        where: { bookingId: booking.id, type: "TICKET" },
      });
      assert.equal(vault, null);
    } finally {
      setTicketSupplierInventoryOverrideForTests(null);
    }
  });

  it("corporate approval flow: PENDING_APPROVAL blocks payment until approved, then unblocks", async () => {
    const admin = await createUser("corp-admin");
    const member = await createUser("corp-member");

    const company = await prisma.company.create({
      data: {
        name: `LifeCorp ${suffix}`,
        creditLimitMinor: 500000,
        creditUsedMinor: 0,
        currency: "USD",
      },
    });
    companies.push(company.id);

    await prisma.companyMembership.createMany({
      data: [
        { companyId: company.id, userId: admin.id, role: "ADMIN" },
        { companyId: company.id, userId: member.id, role: "MEMBER" },
      ],
    });

    await prisma.travelPolicy.create({
      data: {
        companyId: company.id,
        name: "Standard Travel Policy",
        maxAmountMinor: 1000,
        maxCabin: "ECONOMY",
      },
    });

    const booking = await createReservedBooking(member, {
      netMinor: 50000,
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });

    // 1. Without approval request: blocked
    await assert.rejects(
      () =>
        paymentsService.payBooking(member.id, booking.id, {
          method: "corporate_credit",
        }),
      (err) => err.statusCode === 403 && err.code === "APPROVAL_REQUIRED",
    );

    // 2. Submit approval request: PENDING_APPROVAL
    const req = await corporateService.createApprovalRequest(member.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    assert.equal(req.status, "PENDING");

    await assert.rejects(
      () =>
        paymentsService.payBooking(member.id, booking.id, {
          method: "corporate_credit",
        }),
      (err) => err.statusCode === 409 && err.code === "APPROVAL_PENDING",
    );

    // 3. Approver decides: APPROVED
    await corporateService.decideApproval(admin.id, req.id, {
      decision: "APPROVE",
      note: "Corporate travel approved",
    });

    // 4. Now payment succeeds with corporate credit!
    const pay = await paymentsService.payBooking(member.id, booking.id, {
      method: "corporate_credit",
    });
    assert.equal(pay.status, "CAPTURED");
    assert.equal(pay.provider, "CORPORATE_CREDIT");
  });
});

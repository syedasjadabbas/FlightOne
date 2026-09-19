/**
 * Module 14 — Refund & Reissue integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.ALLOW_SIMULATED_PAYMENT = "true";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const refunds = await import("./refunds.service.js");

const suffix = Date.now();
const userIds = [];
const bookingIds = [];
const caseIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.rfd.${label}.${suffix}@example.com`,
      name: `Rfd ${label}`,
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
      product: overrides.product || "FLIGHT",
      status: overrides.status || "TICKETED",
      currency: "USD",
      amountMinor: overrides.amountMinor ?? 10000,
      netMinor: overrides.netMinor ?? 9000,
      marginMinor: overrides.marginMinor ?? 1000,
      supplierCode: overrides.supplierCode || "GALILEO",
      fareRules: overrides.fareRules ?? {
        refundable: true,
        penaltyBps: 1000,
        agencyFeeBps: 0,
      },
      metadata: overrides.metadata || {},
    },
  });
  bookingIds.push(booking.id);
  return booking;
}

const permsWrite = { global: ["refunds:read", "refunds:write"], byCompany: {} };
const permsNone = { global: [], byCompany: {} };

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of caseIds) {
    await prisma.servicingAuditEvent.deleteMany({ where: { refundCaseId: id } }).catch(() => {});
    await prisma.travelCredit.deleteMany({ where: { refundCaseId: id } }).catch(() => {});
    await prisma.servicingRequest.deleteMany({ where: { refundCaseId: id } }).catch(() => {});
    await prisma.refundCase.delete({ where: { id } }).catch(() => {});
  }
  for (const id of bookingIds) {
    await prisma.servicingRequest.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.refundCalculation.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.servicingAuditEvent.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.travelCredit.deleteMany({ where: { sourceBookingId: id } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.bookingTransition.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 14 Refund & Reissue Engine", () => {
  it("airline refund calculation from stored fare rules", async () => {
    const user = await createUser("air");
    const booking = await createBooking(user.id, {
      fareRules: { refundable: true, penaltyBps: 1000, agencyFeeBps: 0 },
    });
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    assert.equal(calc.dataStatus, "OK");
    assert.equal(calc.supplierPenaltyMinor, 1000);
    assert.equal(calc.refundableMinor, 9000);
    assert.equal(calc.product, "FLIGHT");
  });

  it("hotel refund via free-cancel deadline", async () => {
    const user = await createUser("htl");
    const future = new Date(Date.now() + 86400000 * 3).toISOString();
    const booking = await createBooking(user.id, {
      product: "HOTEL",
      supplierCode: "RATEHAWK",
      fareRules: { refundable: true, freeCancelUntil: future, agencyFeeBps: 0 },
    });
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    assert.equal(calc.dataStatus, "OK");
    assert.equal(calc.supplierPenaltyMinor, 0);
    assert.equal(calc.refundableMinor, 10000);
  });

  it("unavailable fare rules → DATA_UNAVAILABLE (no invented money)", async () => {
    const user = await createUser("na");
    const booking = await createBooking(user.id, { fareRules: {} });
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    assert.equal(calc.dataStatus, "DATA_UNAVAILABLE");
    assert.equal(calc.refundableMinor, 0);
  });

  it("eligibility + request + idempotent submit", async () => {
    const user = await createUser("elig");
    const booking = await createBooking(user.id);
    const elig = await refunds.getRefundEligibility(user, permsWrite, booking.id);
    assert.equal(elig.eligible, true);

    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    const c1 = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
      idempotencyKey: `idem-${booking.id}`,
    });
    caseIds.push(c1.id);
    const c2 = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
      idempotencyKey: `idem-${booking.id}`,
    });
    assert.equal(c2.deduplicated, true);
    assert.equal(c2.id, c1.id);

    const submitted = await refunds.submitRefundCase(user, permsWrite, c1.id);
    assert.equal(submitted.status, "SUBMITTED");
    const again = await refunds.submitRefundCase(user, permsWrite, c1.id);
    assert.equal(again.status, "SUBMITTED");
  });

  it("lists only the caller's refundable bookings; hides unconfirmed amounts", async () => {
    const a = await createUser("listA");
    const b = await createUser("listB");
    const own = await createBooking(a.id, { status: "TICKETED" });
    await createBooking(a.id, { status: "CANCELLED" });
    await createBooking(b.id, { status: "TICKETED" });
    const listed = await refunds.listMyRefundableBookings(a);
    assert.ok(listed.items.some((row) => row.bookingId === own.id));
    assert.equal(listed.items.some((row) => row.status === "CANCELLED"), false);
    assert.equal(
      listed.items.some((row) => row.bookingId !== own.id && !listed.items.find((x) => x.bookingId === own.id)),
      false,
    );
    const otherIds = listed.items.map((row) => row.bookingId);
    const bBookings = await prisma.booking.findMany({ where: { userId: b.id }, select: { id: true } });
    assert.equal(bBookings.some((row) => otherIds.includes(row.id)), false);
    const confirmed = listed.items.find((row) => row.bookingId === own.id);
    assert.equal(confirmed.confirmed, true);
    assert.equal(typeof confirmed.refundableMinor, "number");

    const opaque = await createBooking(a.id, { fareRules: {}, status: "TICKETED" });
    const listed2 = await refunds.listMyRefundableBookings(a);
    const hidden = listed2.items.find((row) => row.bookingId === opaque.id);
    assert.equal(hidden.confirmed, false);
    assert.equal(hidden.refundableMinor, null);
  });

  it("idempotency key cannot leak another user's case; unavailable calc stays manual", async () => {
    const a = await createUser("idemA");
    const b = await createUser("idemB");
    const bookingA = await createBooking(a.id);
    const calcA = await refunds.calculateRefund(a, permsWrite, { bookingId: bookingA.id });
    const c = await refunds.createRefundCase(a, permsWrite, {
      bookingId: bookingA.id,
      calculationId: calcA.id,
      idempotencyKey: `shared-key-${suffix}`,
    });
    caseIds.push(c.id);
    const bookingB = await createBooking(b.id);
    const calcB = await refunds.calculateRefund(b, permsWrite, { bookingId: bookingB.id });
    await assert.rejects(
      () =>
        refunds.createRefundCase(b, permsWrite, {
          bookingId: bookingB.id,
          calculationId: calcB.id,
          idempotencyKey: `shared-key-${suffix}`,
        }),
      (e) => e.statusCode === 409,
    );

    const opaqueBooking = await createBooking(a.id, { fareRules: {} });
    const opaqueCalc = await refunds.calculateRefund(a, permsWrite, { bookingId: opaqueBooking.id });
    assert.equal(opaqueCalc.dataStatus, "DATA_UNAVAILABLE");
    const human = await refunds.createRefundCase(a, permsWrite, {
      bookingId: opaqueBooking.id,
      calculationId: opaqueCalc.id,
    });
    caseIds.push(human.id);
    assert.equal(human.status, "REQUIRES_HUMAN");
    const submittedHuman = await refunds.submitRefundCase(a, permsNone, human.id);
    assert.equal(submittedHuman.status, "REQUIRES_HUMAN");
  });

  it("customer isolation / IDOR", async () => {
    const a = await createUser("own");
    const b = await createUser("oth");
    const booking = await createBooking(a.id);
    await assert.rejects(
      () => refunds.getRefundEligibility(b, permsNone, booking.id),
      (e) => e.statusCode === 403,
    );
    const calc = await refunds.calculateRefund(a, permsWrite, { bookingId: booking.id });
    const c = await refunds.createRefundCase(a, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
    });
    caseIds.push(c.id);
    await assert.rejects(
      () => refunds.getRefundCaseById(b, permsNone, c.id),
      (e) => e.statusCode === 403,
    );
  });

  it("process with simulated payment completes ticketed booking", async () => {
    const user = await createUser("pay");
    // grant write via permission object on req
    const booking = await createBooking(user.id, { status: "TICKETED" });
    await prisma.payment.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        status: "CAPTURED",
        provider: "SIMULATED",
        currency: "USD",
        amountMinor: 10000,
        providerPaymentId: `sim_${booking.id}`,
        idempotencyKey: `pay-${booking.id}`,
      },
    });
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    const c = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
    });
    caseIds.push(c.id);
    await refunds.submitRefundCase(user, permsWrite, c.id);

    const req = { permissions: permsWrite };
    const processed = await refunds.processRefundCase(user, req, c.id);
    assert.equal(processed.status, "COMPLETED");
    assert.equal(processed.paymentRefundStatus, "PROVIDER_REFUNDED");

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(bookingAfter.status, "REFUNDED");

    // idempotent complete
    const again = await refunds.completeRefundCase(user, req, c.id);
    assert.equal(again.status, "COMPLETED");
  });

  it("owner submit auto-processes when payment data exists; never false-completes unconfigured gateway", async () => {
    const owner = await createUser("autoOwn");
    const booking = await createBooking(owner.id, { status: "TICKETED" });
    await prisma.payment.create({
      data: {
        userId: owner.id,
        bookingId: booking.id,
        status: "CAPTURED",
        provider: "SIMULATED",
        currency: "USD",
        amountMinor: 10000,
        providerPaymentId: `sim_auto_${booking.id}`,
        idempotencyKey: `pay-auto-${booking.id}`,
      },
    });
    const calc = await refunds.calculateRefund(owner, permsNone, { bookingId: booking.id });
    const opened = await refunds.createRefundCase(owner, permsNone, {
      bookingId: booking.id,
      calculationId: calc.id,
      idempotencyKey: `owner-auto-${booking.id}`,
    });
    caseIds.push(opened.id);
    const submitted = await refunds.submitRefundCase(owner, permsNone, opened.id);
    assert.equal(submitted.status, "COMPLETED");
    assert.equal(submitted.paymentRefundStatus, "PROVIDER_REFUNDED");
    const again = await refunds.processRefundCase(owner, { permissions: permsNone }, opened.id, {
      allowOwnerAuto: true,
    });
    assert.equal(again.status, "COMPLETED");

    const queuedBooking = await createBooking(owner.id, { status: "TICKETED" });
    const queuedCalc = await refunds.calculateRefund(owner, permsNone, {
      bookingId: queuedBooking.id,
    });
    const queuedCase = await refunds.createRefundCase(owner, permsNone, {
      bookingId: queuedBooking.id,
      calculationId: queuedCalc.id,
    });
    caseIds.push(queuedCase.id);
    const queued = await refunds.submitRefundCase(owner, permsNone, queuedCase.id);
    assert.equal(queued.status, "SUBMITTED");
    await assert.rejects(
      () => refunds.processRefundCase(owner, { permissions: permsNone }, queuedCase.id),
      (e) => e.statusCode === 403,
    );

    const prev = process.env.ALLOW_SIMULATED_PAYMENT;
    process.env.ALLOW_SIMULATED_PAYMENT = "false";
    delete process.env.STRIPE_SECRET_KEY;
    const opaque = await createUser("autoFail");
    const opaqueBooking = await createBooking(opaque.id, { status: "TICKETED" });
    await prisma.payment.create({
      data: {
        userId: opaque.id,
        bookingId: opaqueBooking.id,
        status: "CAPTURED",
        provider: "UNCONFIGURED",
        currency: "USD",
        amountMinor: 10000,
        idempotencyKey: `pay-auto-fail-${opaqueBooking.id}`,
      },
    });
    const opaqueCalc = await refunds.calculateRefund(opaque, permsNone, {
      bookingId: opaqueBooking.id,
    });
    const humanCase = await refunds.createRefundCase(opaque, permsNone, {
      bookingId: opaqueBooking.id,
      calculationId: opaqueCalc.id,
    });
    caseIds.push(humanCase.id);
    const manualQueued = await refunds.submitRefundCase(opaque, permsNone, humanCase.id);
    assert.equal(manualQueued.status, "REQUIRES_HUMAN");
    assert.notEqual(manualQueued.status, "COMPLETED");
    const stillTicketed = await prisma.booking.findUnique({ where: { id: opaqueBooking.id } });
    assert.equal(stillTicketed.status, "TICKETED");
    process.env.ALLOW_SIMULATED_PAYMENT = prev;
  });

  it("unconfigured payment → REQUIRES_HUMAN (no fake complete)", async () => {
    const prev = process.env.ALLOW_SIMULATED_PAYMENT;
    process.env.ALLOW_SIMULATED_PAYMENT = "false";
    delete process.env.STRIPE_SECRET_KEY;

    const user = await createUser("man");
    const booking = await createBooking(user.id, { status: "TICKETED" });
    await prisma.payment.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        status: "CAPTURED",
        provider: "UNCONFIGURED",
        currency: "USD",
        amountMinor: 10000,
        idempotencyKey: `pay2-${booking.id}`,
      },
    });
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    const c = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
    });
    caseIds.push(c.id);
    await refunds.submitRefundCase(user, permsWrite, c.id);
    const processed = await refunds.processRefundCase(user, { permissions: permsWrite }, c.id);
    assert.equal(processed.status, "REQUIRES_HUMAN");
    assert.equal(processed.paymentRefundStatus, "PENDING_MANUAL");
    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(bookingAfter.status, "TICKETED");

    process.env.ALLOW_SIMULATED_PAYMENT = prev;
  });

  it("exchange/reissue never fabricates ticket success", async () => {
    const user = await createUser("ex");
    const booking = await createBooking(user.id, {
      fareRules: { changeFeeMinor: 500, changeAllowed: true, agencyFeeBps: 0 },
    });
    const calc = await refunds.calculateExchange(user, permsWrite, {
      bookingId: booking.id,
      newFareMinor: 12000,
      kind: "REISSUE",
    });
    assert.equal(calc.dataStatus, "OK");
    assert.equal(calc.fareDifferenceMinor, 2000);
    assert.equal(calc.changePenaltyMinor, 500);
    assert.equal(calc.liveMutation, false);
    assert.equal(calc.humanServicingPath, true);

    const req = await refunds.requestExchange(user, permsWrite, {
      bookingId: booking.id,
      servicingRequestId: calc.id,
      idempotencyKey: `ex-req-${booking.id}`,
      reason: "Need reissue",
    });
    assert.equal(req.executed, false);
    assert.equal(req.status, "REQUIRES_HUMAN");
    assert.equal(req.humanServicingRequired, true);
    assert.equal(req.liveMutation, false);
    assert.equal(req.ticketMutated, false);
    assert.equal(req.bookingMutated, false);
    assert.equal(req.providerMutationStatus, "UNSUPPORTED");
    assert.equal(req.bookingStatusUnchanged, true);
    assert.equal(req.supplierResponse?.status, "UNSUPPORTED");

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(bookingAfter.status, "TICKETED");
    assert.equal(bookingAfter.externalRef, booking.externalRef);

    const audits = await prisma.servicingAuditEvent.findMany({
      where: { servicingRequestId: calc.id },
    });
    assert.ok(audits.some((a) => a.action === "servicing.exchange.calculated"));
    assert.ok(audits.some((a) => a.action === "servicing.exchange.requested"));

    // idempotency: same key / already REQUIRES_HUMAN
    const again = await refunds.requestExchange(user, permsWrite, {
      bookingId: booking.id,
      servicingRequestId: calc.id,
      idempotencyKey: `ex-req-${booking.id}`,
    });
    assert.equal(again.deduplicated, true);
    assert.equal(again.status, "REQUIRES_HUMAN");
    assert.equal(again.executed, false);

    const again2 = await refunds.requestExchange(user, permsWrite, {
      bookingId: booking.id,
      servicingRequestId: calc.id,
    });
    assert.equal(again2.deduplicated, true);
    assert.equal(again2.ticketMutated, false);
  });

  it("exchange IDOR denied for other customer", async () => {
    const a = await createUser("exown");
    const b = await createUser("exoth");
    const booking = await createBooking(a.id, {
      fareRules: { changeFeeMinor: 100, changeAllowed: true, agencyFeeBps: 0 },
    });
    const calc = await refunds.calculateExchange(a, permsWrite, {
      bookingId: booking.id,
      newFareMinor: 11000,
      kind: "EXCHANGE",
    });
    await assert.rejects(
      () =>
        refunds.requestExchange(b, permsNone, {
          bookingId: booking.id,
          servicingRequestId: calc.id,
        }),
      (e) => e.statusCode === 403,
    );
    await assert.rejects(
      () =>
        refunds.calculateExchange(b, permsNone, {
          bookingId: booking.id,
          newFareMinor: 11000,
        }),
      (e) => e.statusCode === 403,
    );
  });

  it("exchange without supplier live path stays honest (UNSUPPORTED, no success)", async () => {
    const user = await createUser("exnolive");
    const booking = await createBooking(user.id, {
      fareRules: { changeFeeMinor: 0, changeAllowed: true, agencyFeeMinor: 0 },
    });
    const calc = await refunds.calculateExchange(user, permsWrite, {
      bookingId: booking.id,
      newFareMinor: 10000,
      kind: "EXCHANGE",
    });
    const req = await refunds.requestExchange(user, permsWrite, {
      bookingId: booking.id,
      servicingRequestId: calc.id,
    });
    assert.notEqual(req.status, "COMPLETED");
    assert.equal(req.executed, false);
    assert.ok(
      req.supplierResponse?.configured === false ||
        req.supplierResponse?.status === "UNSUPPORTED",
    );
    assert.match(String(req.failureReason || ""), /human/i);
  });

  it("cancellation + schedule-change workflows", async () => {
    const user = await createUser("cx");
    const booking = await createBooking(user.id, { status: "RESERVED" });
    const cancel = await refunds.requestCancellation(user, permsWrite, {
      bookingId: booking.id,
      reason: "Need to cancel",
    });
    caseIds.push(cancel.refundCase.id);
    assert.ok(cancel.servicingRequest.kind === "CANCELLATION");

    const booking2 = await createBooking(user.id);
    const sched = await refunds.createScheduleChangeServicing(user, permsWrite, {
      bookingId: booking2.id,
    });
    caseIds.push(sched.refundCase.id);
    assert.equal(sched.servicingRequest.kind, "SCHEDULE_CHANGE");
    assert.equal(sched.calculation.supplierPenaltyMinor, 0);
  });

  it("partial refund calculation", async () => {
    const user = await createUser("part");
    const booking = await createBooking(user.id);
    const calc = await refunds.calculateRefund(user, permsWrite, {
      bookingId: booking.id,
      partialRatio: 0.5,
      kind: "PARTIAL_REFUND",
    });
    assert.equal(calc.kind, "PARTIAL_REFUND");
    assert.equal(calc.refundableMinor, 4500);
  });

  it("travel credit issuance on complete when calculation has credit", async () => {
    const user = await createUser("tc");
    const booking = await createBooking(user.id, {
      status: "TICKETED",
      fareRules: {
        refundable: true,
        penaltyMinor: 10000,
        agencyFeeBps: 0,
        travelCreditEligible: true,
        travelCreditMinor: 3000,
      },
    });
    await prisma.payment.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        status: "CAPTURED",
        provider: "SIMULATED",
        currency: "USD",
        amountMinor: 10000,
        providerPaymentId: `sim_tc_${booking.id}`,
        idempotencyKey: `pay-tc-${booking.id}`,
      },
    });
    process.env.ALLOW_SIMULATED_PAYMENT = "true";
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    assert.equal(calc.travelCreditMinor, 3000);
    const c = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
    });
    caseIds.push(c.id);
    await refunds.submitRefundCase(user, permsWrite, c.id);
    await refunds.processRefundCase(user, { permissions: permsWrite }, c.id);
    const credits = await refunds.listTravelCredits(user, permsWrite);
    assert.ok(credits.items.some((x) => x.sourceBookingId === booking.id && x.amountMinor === 3000));
  });

  it("Ava guidance never invents amounts", async () => {
    const user = await createUser("ava");
    const booking = await createBooking(user.id, { fareRules: {} });
    const g = await refunds.buildAvaRefundGuidance(user.id, booking.id);
    assert.ok(g.promptBlock.includes("DATA_UNAVAILABLE") || g.promptBlock.includes("dataStatus"));
    assert.ok(g.promptBlock.includes("Never claim") || g.promptBlock.includes("Do NOT"));
  });

  it("notification dedupe on case create", async () => {
    const user = await createUser("ntf");
    const booking = await createBooking(user.id);
    const calc = await refunds.calculateRefund(user, permsWrite, { bookingId: booking.id });
    const c = await refunds.createRefundCase(user, permsWrite, {
      bookingId: booking.id,
      calculationId: calc.id,
    });
    caseIds.push(c.id);
    const { notifyServicingUsers } = await import("./refunds.notify.js");
    const again = await notifyServicingUsers({
      userIds: [user.id],
      dedupeKeyPrefix: `refund:case:created:${c.id}`,
      title: "x",
      body: "y",
    });
    assert.equal(again.enqueued, 0);
  });
});

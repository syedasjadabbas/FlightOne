/**
 * Module 03 — payment, corporate approval, AirPrice → real reservation.
 * Requires DATABASE_URL. Never invents live gateway or Travelport success.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

process.env.NODE_ENV = "test";
delete process.env.STRIPE_SECRET_KEY;

const { default: prisma } = await import("../../config/prisma.js");
const bookingsService = await import("../bookings/bookings.service.js");
const paymentsService = await import("./payments.service.js");
const corporateService = await import("../corporate/corporate.service.js");
const {
  setReserveSupplierInventoryOverrideForTests,
  setTicketSupplierInventoryOverrideForTests,
} = await import("../suppliers/supplierBooking.js");

const suffix = Date.now();
const users = [];
const companies = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.payres.${label}.${suffix}@example.com`,
      name: `PayRes ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

async function createSupplierSnapshot({ userId, supplierOfferId = "SIM-10000", netMinor = 10000 }) {
  return prisma.supplierOfferSnapshot.create({
    data: {
      userId,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId,
      currency: "USD",
      netMinor,
      supplierBookingRefs: {
        transactionId: "t-snap-1",
        combinabilityCode: "C1",
        productRef: "p-1",
        brandRef: "b-1",
        flightRefs: ["f-1"],
        returnFlightRefs: null,
        contentSource: "GDS",
      },
      ttlMs: 60_000,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

async function quotePersonal(user, extra = {}) {
  const snapshot = await createSupplierSnapshot({
    userId: user.id,
    supplierOfferId: extra.supplierOfferId ?? "SIM-8000",
    netMinor: extra.netMinor ?? 8000,
  });
  return bookingsService.createQuote(user.id, {
    product: "FLIGHT",
    currency: "USD",
    supplierOfferSnapshotId: snapshot.id,
    route: extra.route ?? "ISB-JED",
    cabin: "ECONOMY",
    metadata: extra.metadata,
  });
}

before(async () => {
  process.env.ALLOW_SIMULATED_BOOKING = "true";
  process.env.ALLOW_SIMULATED_PAYMENT = "true";
  process.env.NODE_ENV = "test";
  delete process.env.STRIPE_SECRET_KEY;
  await prisma.$queryRaw`SELECT 1`;
  const pricingKeys = [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
    ["hotel_default_markup_bps", 1400],
  ];
  for (const [key, valueInt] of pricingKeys) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  const { invalidatePricingLookupCache } = await import("../pricing/pricing.service.js");
  invalidatePricingLookupCache();
});

after(async () => {
  setReserveSupplierInventoryOverrideForTests(null);
  setTicketSupplierInventoryOverrideForTests(null);
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  for (const id of companies) {
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("payment capture", () => {
  it("payment unconfigured is honest (503) and does not mark success", async () => {
    const prev = process.env.ALLOW_SIMULATED_PAYMENT;
    delete process.env.ALLOW_SIMULATED_PAYMENT;
    try {
      const user = await createUser("unconfigured");
      const booking = await quotePersonal(user);
      await assert.rejects(
        () =>
          paymentsService.payBooking(user.id, booking.id, {
            paymentMethodToken: "pm_test_ok",
          }),
        (err) => err.statusCode === 503 && err.code === paymentsService.PAYMENT_UNCONFIGURED,
      );
      const rows = await prisma.payment.findMany({ where: { bookingId: booking.id } });
      assert.equal(rows.length, 0);
      const cap = paymentsService.getPaymentCapability();
      assert.equal(cap.configured, false);
    } finally {
      process.env.ALLOW_SIMULATED_PAYMENT = prev;
    }
  });

  it("payment failure persists FAILED and does not authorize", async () => {
    const user = await createUser("pay-fail");
    const booking = await quotePersonal(user);
    await assert.rejects(
      () =>
        paymentsService.payBooking(user.id, booking.id, {
          paymentMethodToken: "pm_fail_card",
        }),
      (err) => err.statusCode === 402 && err.code === "PAYMENT_FAILED",
    );
    const row = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
    assert.equal(row.status, "FAILED");
    assert.equal(row.provider, "SIMULATED");
    assert.equal(await paymentsService.getSuccessfulPayment(booking.id, user.id), null);
  });

  it("successful tokenized payment is CAPTURED with a provider id", async () => {
    const user = await createUser("pay-ok");
    const booking = await quotePersonal(user);
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
      idempotencyKey: `pay-ok-${suffix}`,
    });
    assert.equal(pay.status, "CAPTURED");
    assert.ok(pay.providerPaymentId);
    assert.equal(pay.paymentMethodToken, undefined);
    assert.doesNotMatch(String(pay.providerPaymentId || ""), /^\d{13,19}$/);
    const again = await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
      idempotencyKey: `pay-ok-${suffix}`,
    });
    assert.equal(again.id, pay.id);
  });

  it("user isolation: cannot pay another user's booking", async () => {
    const a = await createUser("pay-iso-a");
    const b = await createUser("pay-iso-b");
    const booking = await quotePersonal(a);
    await assert.rejects(
      () =>
        paymentsService.payBooking(b.id, booking.id, {
          paymentMethodToken: "pm_test_ok",
        }),
      (err) => err.statusCode === 404,
    );
  });
});

describe("corporate approval workflow", () => {
  async function setupCorporate({ policyMaxMinor }) {
    const user = await createUser(`corp-${policyMaxMinor}-${Math.random().toString(16).slice(2)}`);
    const company = await corporateService.createCompany(
      user.id,
      {
        name: `Corp ${suffix} ${user.id.slice(-6)}`,
        creditLimitMinor: 5_000_000,
        currency: "USD",
      },
      { global: ["corporate:company:write"], byCompany: {} },
    );
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Default",
      maxCabin: "ECONOMY",
      maxAmountMinor: policyMaxMinor,
    });
    const snapshot = await createSupplierSnapshot({
      userId: user.id,
      supplierOfferId: "SIM-10000",
      netMinor: 10000,
    });
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    return { user, company, booking };
  }

  it("approval required — no ApprovalRequest blocks pay and reserve", async () => {
    const { user, booking } = await setupCorporate({ policyMaxMinor: 50 });
    await assert.rejects(
      () =>
        paymentsService.payBooking(user.id, booking.id, { method: "corporate_credit" }),
      (err) => err.statusCode === 403 && err.code === "APPROVAL_REQUIRED",
    );
    await assert.rejects(
      () => bookingsService.reserveBooking(user.id, booking.id, {}),
      (err) => err.statusCode === 403 && err.code === "APPROVAL_REQUIRED",
    );
    const still = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(still.status, "QUOTED");
    assert.equal(still.externalRef, null);
  });

  it("approval pending — policy violation waits for a human decision", async () => {
    const { user, company, booking } = await setupCorporate({ policyMaxMinor: 50 });
    const req = await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    assert.equal(req.status, "PENDING");
    await assert.rejects(
      () =>
        paymentsService.payBooking(user.id, booking.id, { method: "corporate_credit" }),
      (err) => err.statusCode === 409 && err.code === "APPROVAL_PENDING",
    );
    await assert.rejects(
      () => bookingsService.reserveBooking(user.id, booking.id, {}),
      (err) => err.statusCode === 409 && err.code === "APPROVAL_PENDING",
    );
  });

  it("approval approved — real APPROVED row then corporate credit + reserve", async () => {
    const { user, company, booking } = await setupCorporate({ policyMaxMinor: 50 });
    const pending = await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    const decided = await corporateService.decideApproval(user.id, pending.id, {
      decision: "APPROVE",
      note: "ok",
    });
    assert.equal(decided.status, "APPROVED");
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      method: "corporate_credit",
    });
    assert.equal(pay.status, "CAPTURED");
    assert.equal(pay.provider, "CORPORATE_CREDIT");
    const reserved = await bookingsService.reserveBooking(user.id, booking.id, {});
    assert.equal(reserved.status, "RESERVED");
    const transitions = await prisma.bookingTransition.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(transitions.some((t) => t.toStatus === "RESERVED"));
  });

  it("approval rejected — booking cannot proceed", async () => {
    const { user, company, booking } = await setupCorporate({ policyMaxMinor: 50 });
    const pending = await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    await corporateService.decideApproval(user.id, pending.id, {
      decision: "REJECT",
      note: "no",
    });
    await assert.rejects(
      () =>
        paymentsService.payBooking(user.id, booking.id, { method: "corporate_credit" }),
      (err) => err.statusCode === 403 && err.code === "APPROVAL_REJECTED",
    );
    await assert.rejects(
      () => bookingsService.reserveBooking(user.id, booking.id, {}),
      (err) => err.statusCode === 403 && err.code === "APPROVAL_REJECTED",
    );
    const still = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(still.status, "QUOTED");
  });

  it("company isolation — approvals are not visible across companies", async () => {
    const a = await setupCorporate({ policyMaxMinor: 50 });
    const b = await setupCorporate({ policyMaxMinor: 50 });
    await corporateService.createApprovalRequest(a.user.id, {
      bookingId: a.booking.id,
      companyId: a.company.id,
    });
    const listed = await corporateService.listApprovals(b.user.id, {}, { global: [] });
    assert.ok(listed.items.every((row) => row.companyId === b.company.id));
    assert.ok(listed.items.every((row) => row.companyId !== a.company.id));
    await assert.rejects(
      () =>
        corporateService.listApprovals(
          b.user.id,
          { companyId: a.company.id },
          { global: [] },
        ),
      (err) => err.statusCode === 403,
    );
  });
});

describe("AirPrice → payment/approval → reservation", () => {
  it("blocks reserve without payment after successful revalidation", async () => {
    const user = await createUser("need-pay");
    const booking = await quotePersonal(user);
    await assert.rejects(
      () => bookingsService.reserveBooking(user.id, booking.id, {}),
      (err) => err.statusCode === 402 && err.code === "PAYMENT_REQUIRED",
    );
    const still = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(still.status, "QUOTED");
    assert.equal(still.externalRef, null);
  });

  it("simulated AirPrice + payment → RESERVED without fabricating a PNR", async () => {
    const user = await createUser("airprice-pay");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    const reserved = await bookingsService.reserveBooking(user.id, booking.id, {});
    assert.equal(reserved.status, "RESERVED");
    assert.equal(reserved.externalRef, null);
    assert.equal(reserved.metadata?.supplierBooking?.reserve?.status, "simulated");
  });

  it("supplier reservation failure stays QUOTED, voids payment, no PNR", async () => {
    const user = await createUser("sup-fail");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    setReserveSupplierInventoryOverrideForTests(() => ({
      status: "failed",
      externalRef: null,
      details: { reason: "supplier workbench rejected" },
    }));
    try {
      await assert.rejects(
        () => bookingsService.reserveBooking(user.id, booking.id, {}),
        (err) => err.statusCode === 409 && /workbench rejected/i.test(err.message),
      );
      const still = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(still.status, "QUOTED");
      assert.equal(still.externalRef, null);
      assert.equal(still.reservationAttemptId, null);
      const pay = await prisma.payment.findFirst({
        where: { bookingId: booking.id },
        orderBy: { createdAt: "desc" },
      });
      assert.equal(pay.status, "VOIDED");
      const reservedRows = await prisma.bookingTransition.findMany({
        where: { bookingId: booking.id, toStatus: "RESERVED" },
      });
      assert.equal(reservedRows.length, 0);
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
    }
  });

  it("persists a real locator only after supplier status ok", async () => {
    const user = await createUser("real-pnr");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    setReserveSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "1A2B3C",
      details: { source: "travelport-test-double" },
    }));
    try {
      const reserved = await bookingsService.reserveBooking(user.id, booking.id, {});
      assert.equal(reserved.status, "RESERVED");
      assert.equal(reserved.externalRef, "1A2B3C");
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
    }
  });

  it("duplicate/retry does not call the supplier twice after success", async () => {
    const user = await createUser("dup-rsv");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    let calls = 0;
    setReserveSupplierInventoryOverrideForTests(() => {
      calls += 1;
      return {
        status: "ok",
        externalRef: "PNRDUP1",
        details: { n: calls },
      };
    });
    try {
      const first = await bookingsService.reserveBooking(user.id, booking.id, {});
      const second = await bookingsService.reserveBooking(user.id, booking.id, {});
      assert.equal(first.status, "RESERVED");
      assert.equal(second.status, "RESERVED");
      assert.equal(first.id, second.id);
      assert.equal(second.externalRef, "PNRDUP1");
      assert.equal(calls, 1);
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
    }
  });

  it("tickets only after real supplier ticket numbers and is idempotent", async () => {
    const user = await createUser("ticket-ok");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    setReserveSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNRTKT1",
      details: {},
    }));
    setTicketSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNRTKT1",
      ticketNumbers: ["0012345678901"],
      details: { source: "test-double" },
    }));
    try {
      await bookingsService.reserveBooking(user.id, booking.id, {
        travellerSnapshot: { givenName: "Ada", surname: "Lovelace" },
      });
      const ticketed = await bookingsService.ticketBooking(user.id, booking.id, {});
      assert.equal(ticketed.status, "TICKETED");
      assert.deepEqual(ticketed.metadata?.supplierBooking?.ticket?.ticketNumbers, ["0012345678901"]);
      const again = await bookingsService.ticketBooking(user.id, booking.id, {});
      assert.equal(again.id, ticketed.id);
      const vault = await prisma.vaultDocument.findFirst({
        where: { bookingId: ticketed.id, type: "TICKET" },
      });
      assert.ok(vault);
      assert.deepEqual(vault.fileMeta?.ticketNumbers, ["0012345678901"]);
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
      setTicketSupplierInventoryOverrideForTests(null);
    }
  });

  it("supplier ticket failure stays RESERVED without fabricating tickets", async () => {
    const user = await createUser("ticket-fail");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      paymentMethodToken: "pm_test_ok",
    });
    setReserveSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNRFAIL1",
      details: {},
    }));
    setTicketSupplierInventoryOverrideForTests(() => ({
      status: "failed",
      details: { reason: "ticketing workbench rejected" },
    }));
    try {
      await bookingsService.reserveBooking(user.id, booking.id, {
        travellerSnapshot: { givenName: "Ada", surname: "Lovelace" },
      });
      await assert.rejects(
        () => bookingsService.ticketBooking(user.id, booking.id, {}),
        (err) => err.statusCode === 409 && /workbench rejected/i.test(err.message),
      );
      const still = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(still.status, "RESERVED");
      assert.equal(still.externalRef, "PNRFAIL1");
      assert.equal(still.ticketAttemptId, null);
      const vault = await prisma.vaultDocument.findFirst({
        where: { bookingId: booking.id, type: "TICKET" },
      });
      assert.equal(vault, null);
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
      setTicketSupplierInventoryOverrideForTests(null);
    }
  });
});

describe("local payments lifecycle (JazzCash, Easypaisa, 1Link IBFT)", () => {

  it("JazzCash success captures with masked account and JAZZCASH provider", async () => {
    const user = await createUser("jc-ok");
    const booking = await quotePersonal(user);
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      method: "jazzcash",
      accountNumber: "03001234567",
      idempotencyKey: `jc-pay-${suffix}`,
    });
    assert.equal(pay.status, "CAPTURED");
    assert.equal(pay.provider, "JAZZCASH");
    assert.ok(pay.providerPaymentId.startsWith("jc_sim_"));
    assert.equal(pay.metadata?.accountNumberMasked, "0300****67");

    // Idempotent retry returns identical payment record
    const retry = await paymentsService.payBooking(user.id, booking.id, {
      method: "jazzcash",
      accountNumber: "03001234567",
      idempotencyKey: `jc-pay-${suffix}`,
    });
    assert.equal(retry.id, pay.id);
  });

  it("JazzCash decline persists FAILED and does not trigger ticketing", async () => {
    const user = await createUser("jc-fail");
    const booking = await quotePersonal(user);
    await assert.rejects(
      () =>
        paymentsService.payBooking(user.id, booking.id, {
          method: "jazzcash",
          accountNumber: "03009999999",
        }),
      (err) => err.statusCode === 402 && err.code === "PAYMENT_FAILED",
    );
    const row = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
    assert.equal(row.status, "FAILED");
    assert.equal(row.provider, "JAZZCASH");
    const check = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.notEqual(check.status, "TICKETED");
  });

  it("Easypaisa success captures with masked account and EASYPAISA provider", async () => {
    const user = await createUser("ep-ok");
    const booking = await quotePersonal(user);
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      method: "easypaisa",
      accountNumber: "03451234567",
      idempotencyKey: `ep-pay-${suffix}`,
    });
    assert.equal(pay.status, "CAPTURED");
    assert.equal(pay.provider, "EASYPAISA");
    assert.ok(pay.providerPaymentId.startsWith("ep_sim_"));
    assert.equal(pay.metadata?.accountNumberMasked, "0345****67");
  });

  it("1Link IBFT initiates PENDING hold, enforces hold-before-ticketing, then Ops confirmation tickets", async () => {
    const user = await createUser("1link-flow");
    const booking = await quotePersonal(user);

    setReserveSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNR1LINK",
      details: {},
    }));
    setTicketSupplierInventoryOverrideForTests(() => ({
      status: "ok",
      externalRef: "PNR1LINK",
      ticketNumbers: ["1234567890999"],
      details: { source: "test-1link" },
    }));

    try {
      // Initiate 1Link IBFT payment — creates PENDING payment record
      const pendingPay = await paymentsService.payBooking(user.id, booking.id, {
        method: "onelink_ibft",
        idempotencyKey: `1l-hold-${suffix}`,
      });
      assert.equal(pendingPay.status, "PENDING");
      assert.equal(pendingPay.provider, "ONELINK_IBFT");
      assert.ok(pendingPay.providerPaymentId.startsWith("ibft_"));
      assert.ok(pendingPay.metadata?.consumerNumber);
      assert.ok(pendingPay.metadata?.iban);

      // Reserve seat with supplier while payment is in PENDING hold
      await bookingsService.reserveBooking(user.id, booking.id, {
        travellerSnapshot: { givenName: "Fatima", surname: "Khan" },
      });
      const reservedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(reservedBooking.status, "RESERVED");

      // CRITICAL: Ensure ticketing was NOT triggered while in PENDING hold
      await assert.rejects(
        () => bookingsService.ticketBooking(user.id, booking.id, {}),
        (err) => err.statusCode === 402 && err.code === "PAYMENT_REQUIRED",
      );
      const stillReserved = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(stillReserved.status, "RESERVED");

      // Ops / Finance confirms bank clearance
      const confirmed = await paymentsService.confirmBankTransferPayment(pendingPay.id, {
        staffUserId: "ops_finance_agent_1",
        bankReference: "HBL_FT_9928172",
      });
      assert.equal(confirmed.status, "CAPTURED");
      assert.equal(confirmed.metadata?.manualOpsConfirmation?.bankReference, "HBL_FT_9928172");

      // After confirmation on a RESERVED booking, ticketing is automatically triggered
      const ticketed = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.ok(["TICKETED", "ACTIVE"].includes(ticketed.status));
    } finally {
      setReserveSupplierInventoryOverrideForTests(null);
      setTicketSupplierInventoryOverrideForTests(null);
    }
  });

  it("duplicate 1Link callback is idempotent and does not re-ticket", async () => {
    const user = await createUser("1link-dupe");
    const booking = await quotePersonal(user);
    const pay = await paymentsService.payBooking(user.id, booking.id, {
      method: "onelink_ibft",
      idempotencyKey: `1l-dupe-${suffix}`,
    });

    const consumerNumber = pay.metadata.consumerNumber;
    const cbResult1 = await paymentsService.handleOneLinkCallback({
      consumerNumber,
      transactionId: "TXN_BANK_123",
      amount: booking.amountMinor,
      bankCode: "014",
    });
    assert.equal(cbResult1.status, "CAPTURED");

    // Second duplicate callback
    const cbResult2 = await paymentsService.handleOneLinkCallback({
      consumerNumber,
      transactionId: "TXN_BANK_123",
      amount: booking.amountMinor,
      bankCode: "014",
    });
    assert.equal(cbResult2.status, "CAPTURED");
    assert.equal(cbResult2.alreadyProcessed, true);
  });

  it("local payments are compatible with refund/void lifecycle", async () => {
    const { attemptPaymentRefundForBooking } = await import("../refunds/refunds.payment.js");
    const user = await createUser("local-refund");
    const booking = await quotePersonal(user);
    await paymentsService.payBooking(user.id, booking.id, {
      method: "jazzcash",
      accountNumber: "03001234567",
      idempotencyKey: `jc-ref-${suffix}`,
    });

    // Attempt refund via refunds.payment adapter
    const refundRes = await attemptPaymentRefundForBooking(prisma, booking.id, {
      amountMinor: booking.amountMinor,
      idempotencyKey: `refund-jc-${suffix}`,
    });
    assert.ok(["PROVIDER_REFUNDED", "PENDING_MANUAL"].includes(refundRes.status));

    // Verify payment was voided if simulated
    if (refundRes.status === "PROVIDER_REFUNDED") {
      const voidedPay = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
      assert.equal(voidedPay.status, "VOIDED");
    }
  });
});


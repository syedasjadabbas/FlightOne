/**
 * Module 06 — corporate service unit/integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const { default: prisma } = await import("../../config/prisma.js");
const corporateService = await import("./corporate.service.js");
const invoiceService = await import("./corporate.invoices.js");

// These tests assert that the credit / policy / approval gates REJECT. A local
// `.env` with DEMO_FLIGHT_INVENTORY=true enables the demo bypass and would
// silently turn those assertions green. Cleared AFTER the imports above —
// config/prisma.js calls dotenv.config() again and would restore it.
delete process.env.DEMO_FLIGHT_INVENTORY;

const FINANCE_PERMS = { global: ["corporate:company:write"], byCompany: {} };
const bookingsService = await import("../bookings/bookings.service.js");
const pricingService = await import("../pricing/pricing.service.js");

const suffix = Date.now();
const users = [];
const companies = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.corp.${label}.${suffix}@example.com`,
      name: `Corp ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
      profile: {
        create: {
          displayName: `Traveller ${label}`,
          preferredCabin: "ECONOMY",
          preferredAirlines: ["PK"],
        },
      },
    },
  });
  users.push(user.id);
  return user;
}

async function createSnapshot(userId, netMinor = 10000) {
  return prisma.supplierOfferSnapshot.create({
    data: {
      userId,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: `SIM-${netMinor}`,
      currency: "USD",
      netMinor,
      supplierBookingRefs: {
        transactionId: "t-1",
        combinabilityCode: "C1",
        productRef: "p-1",
        brandRef: "b-1",
        flightRefs: ["f-1"],
      },
      ttlMs: 60_000,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  for (const [key, valueInt] of [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
    ["hotel_default_markup_bps", 1400],
    ["min_margin_bps", 400],
    ["ai_discount_max_bps", 500],
  ]) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  pricingService.invalidatePricingLookupCache();
});

after(async () => {
  for (const id of companies) {
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 06 — membership isolation & authorization", () => {
  it("rejects forged companyId on quote for non-members", async () => {
    const owner = await createUser("owner-forge");
    const stranger = await createUser("stranger-forge");
    const company = await corporateService.createCompany(owner.id, {
      name: `Forge Co ${suffix}`,
      creditLimitMinor: 1_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);

    const snap = await createSnapshot(stranger.id);
    await assert.rejects(
      () =>
        bookingsService.createQuote(stranger.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snap.id,
          route: "ISB-JED",
          cabin: "ECONOMY",
          metadata: { companyId: company.id, cabin: "ECONOMY" },
        }),
      (err) => err.statusCode === 403 && /not a member/i.test(err.message),
    );
  });

  it("only company ADMIN may add members; members cannot manage other companies", async () => {
    const admin = await createUser("admin-add");
    const member = await createUser("member-add");
    const outsider = await createUser("outsider-add");
    const company = await corporateService.createCompany(admin.id, {
      name: `Add Co ${suffix}`,
      creditLimitMinor: 500_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);

    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });

    await assert.rejects(
      () =>
        corporateService.addMember(member.id, company.id, {
          userId: outsider.id,
          role: "MEMBER",
        }),
      (err) => err.statusCode === 403,
    );

    await assert.rejects(
      () => corporateService.listMembers(outsider.id, company.id),
      (err) => err.statusCode === 403,
    );
  });

  it("listMembers attaches TravellerProfile summary without duplicating Module 02", async () => {
    const admin = await createUser("admin-profile");
    const company = await corporateService.createCompany(admin.id, {
      name: `Profile Co ${suffix}`,
      creditLimitMinor: 100_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    const members = await corporateService.listMembers(admin.id, company.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].traveller.displayName, "Traveller admin-profile");
    assert.equal(members[0].traveller.preferredCabin, "ECONOMY");
  });
});

describe("Module 06 — policy vs approval", () => {
  it("evaluatePolicy is independent of approval status", async () => {
    const user = await createUser("policy-eval");
    const company = await corporateService.createCompany(user.id, {
      name: `Policy Co ${suffix}`,
      creditLimitMinor: 1_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Strict",
      maxCabin: "ECONOMY",
      maxAmountMinor: 50,
      preferredAirlines: ["PK"],
      advanceBookingDays: 7,
    });

    const fail = await corporateService.evaluatePolicy({
      companyId: company.id,
      amountMinor: 20_000,
      cabin: "BUSINESS",
      airline: "EK",
      departureDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(fail.withinPolicy, false);
    assert.ok(fail.violations.some((v) => v.code === "AMOUNT_EXCEEDS_MAX"));
    assert.ok(fail.violations.some((v) => v.code === "CABIN_EXCEEDS_MAX"));
    assert.ok(fail.violations.some((v) => v.code === "AIRLINE_NOT_PREFERRED"));
    assert.ok(fail.violations.some((v) => v.code === "ADVANCE_BOOKING_WINDOW"));

    const pass = await corporateService.evaluatePolicy({
      companyId: company.id,
      amountMinor: 40,
      cabin: "ECONOMY",
      airline: "PK",
      departureDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(pass.withinPolicy, true);
    assert.equal(pass.violations.length, 0);
  });

  it("within-policy approval auto-APPROVES; over-policy stays PENDING until decided", async () => {
    const user = await createUser("auto-appr");
    const company = await corporateService.createCompany(user.id, {
      name: `Auto Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Cap",
      maxCabin: "ECONOMY",
      maxAmountMinor: 50_000,
    });

    const snap = await createSnapshot(user.id, 10000);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    assert.equal(booking.metadata.companyId, company.id);
    assert.equal(typeof booking.metadata.policyEvaluation?.withinPolicy, "boolean");

    const auto = await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    assert.equal(auto.status, "APPROVED");

    const snap2 = await createSnapshot(user.id, 10000);
    const bookingHigh = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap2.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    // Tighten policy after quote amount already set — create approval against low max.
    await corporateService.createPolicy(user.id, company.id, {
      name: "Tight",
      maxCabin: "ECONOMY",
      maxAmountMinor: 50,
    });
    const pending = await corporateService.createApprovalRequest(user.id, {
      bookingId: bookingHigh.id,
      companyId: company.id,
    });
    assert.equal(pending.status, "PENDING");
  });
});

describe("Module 06 — credit, pricing hook, audit, profile", () => {
  it("enforces corporate credit limit", async () => {
    const user = await createUser("credit");
    const company = await corporateService.createCompany(user.id, {
      name: `Credit Co ${suffix}`,
      creditLimitMinor: 100,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Any",
      maxAmountMinor: 1_000_000,
    });
    const snap = await createSnapshot(user.id, 10000);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    await assert.rejects(
      () =>
        corporateService.assertCorporateBookingAllowed({
          userId: user.id,
          companyId: company.id,
          bookingId: booking.id,
          amountMinor: booking.amountMinor,
          currency: "USD",
          cabin: "ECONOMY",
        }),
      (err) => err.statusCode === 402 && /credit limit/i.test(err.message),
    );
  });

  it("Company.markupBps feeds Module 05 companyMarkupBps (no double markup)", async () => {
    const user = await createUser("markup");
    const company = await corporateService.createCompany(user.id, {
      name: `Markup Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
      markupBps: 700,
    }, FINANCE_PERMS);
    companies.push(company.id);

    const snap = await createSnapshot(user.id, 10000);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    assert.equal(booking.amountMinor, Math.round(10_000 * 1.07));
    assert.equal(booking.metadata.pricing.appliedRules[0].type, "CORPORATE_MARKUP");
    assert.equal(booking.metadata.pricing.input.companyMarkupBps, 700);
  });

  it("resolveActiveProfile never trusts unverified companyId", async () => {
    const owner = await createUser("prof-owner");
    const stranger = await createUser("prof-stranger");
    const company = await corporateService.createCompany(owner.id, {
      name: `Active Co ${suffix}`,
      creditLimitMinor: 100_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);

    const personal = await corporateService.resolveActiveProfile(owner.id, {
      mode: "PERSONAL",
    });
    assert.equal(personal.mode, "PERSONAL");
    assert.equal(personal.companyId, null);

    const corp = await corporateService.resolveActiveProfile(owner.id, {
      mode: "CORPORATE",
      companyId: company.id,
    });
    assert.equal(corp.mode, "CORPORATE");
    assert.equal(corp.companyId, company.id);
    assert.ok(corp.travellerProfile);

    await assert.rejects(
      () =>
        corporateService.resolveActiveProfile(stranger.id, {
          mode: "CORPORATE",
          companyId: company.id,
        }),
      (err) => err.statusCode === 403,
    );
  });

  it("records auditable corporate actions for company ADMIN", async () => {
    const admin = await createUser("audit-admin");
    const company = await corporateService.createCompany(admin.id, {
      name: `Audit Co ${suffix}`,
      creditLimitMinor: 100_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(admin.id, company.id, {
      name: "Audited policy",
      maxAmountMinor: 1000,
    });

    // Allow async audit writes to settle.
    await new Promise((r) => setTimeout(r, 50));
    const audit = await corporateService.listCompanyAudit(admin.id, company.id);
    assert.ok(audit.total >= 1);
    assert.ok(audit.items.some((row) => row.action.startsWith("corporate.")));
  });
});

describe("Module 06 — admin mutations, approval gate, booking visibility", () => {
  it("finance permission can update credit/markup; company ADMIN alone cannot; MEMBER cannot", async () => {
    const admin = await createUser("upd-admin");
    const member = await createUser("upd-member");
    const company = await corporateService.createCompany(
      admin.id,
      {
        name: `Upd Co ${suffix}`,
        creditLimitMinor: 1_000_000,
        currency: "USD",
        markupBps: 500,
      },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });

    await assert.rejects(
      () =>
        corporateService.updateCompany(admin.id, company.id, {
          creditLimitMinor: 2_000_000,
        }),
      (err) => err.statusCode === 403 && /corporate:company:write/i.test(err.message),
    );

    const billed = await corporateService.updateCompany(admin.id, company.id, {
      billingCycle: "MONTHLY",
    });
    assert.equal(billed.billingCycle, "MONTHLY");
    assert.equal(billed.creditLimitMinor, 1_000_000);

    const updated = await corporateService.updateCompany(
      admin.id,
      company.id,
      {
        creditLimitMinor: 2_000_000,
        markupBps: 800,
      },
      FINANCE_PERMS,
    );
    assert.equal(updated.creditLimitMinor, 2_000_000);
    assert.equal(updated.markupBps, 800);

    await assert.rejects(
      () =>
        corporateService.updateCompany(
          member.id,
          company.id,
          { markupBps: 100 },
          FINANCE_PERMS,
        ),
      (err) => err.statusCode === 403,
    );
  });

  it("MEMBER cannot create/update policies or decide approvals", async () => {
    const admin = await createUser("pol-admin");
    const member = await createUser("pol-member");
    const company = await corporateService.createCompany(admin.id, {
      name: `Pol Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });
    const policy = await corporateService.createPolicy(admin.id, company.id, {
      name: "Base",
      maxAmountMinor: 50,
      maxCabin: "ECONOMY",
    });

    await assert.rejects(
      () =>
        corporateService.createPolicy(member.id, company.id, {
          name: "Hack",
          maxAmountMinor: 999_999,
        }),
      (err) => err.statusCode === 403,
    );
    await assert.rejects(
      () =>
        corporateService.updatePolicy(member.id, company.id, policy.id, {
          maxAmountMinor: 999_999,
        }),
      (err) => err.statusCode === 403,
    );

    const snap = await createSnapshot(member.id, 10000);
    const booking = await bookingsService.createQuote(member.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    const pending = await corporateService.createApprovalRequest(member.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    assert.equal(pending.status, "PENDING");

    await assert.rejects(
      () =>
        corporateService.decideApproval(member.id, pending.id, {
          decision: "APPROVE",
        }),
      (err) => err.statusCode === 403,
    );
  });

  it("approval gate reports REQUIRED → PENDING → APPROVED and policy stays separate", async () => {
    const admin = await createUser("gate-admin");
    const company = await corporateService.createCompany(admin.id, {
      name: `Gate Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(admin.id, company.id, {
      name: "Tight",
      maxAmountMinor: 50,
      maxCabin: "ECONOMY",
    });
    const snap = await createSnapshot(admin.id, 10000);
    const booking = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });

    const required = await corporateService.getBookingApprovalGate(admin.id, booking.id);
    assert.equal(required.approvalStatus, "REQUIRED");
    assert.equal(required.canProceed, false);
    assert.equal(required.policyEvaluation.withinPolicy, false);

    const pending = await corporateService.createApprovalRequest(admin.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    assert.equal(pending.status, "PENDING");
    const pendingGate = await corporateService.getBookingApprovalGate(admin.id, booking.id);
    assert.equal(pendingGate.approvalStatus, "PENDING");
    assert.equal(pendingGate.canProceed, false);
    // Policy evaluation is independent of approval status.
    assert.equal(pendingGate.policyEvaluation.withinPolicy, false);

    await corporateService.decideApproval(admin.id, pending.id, { decision: "APPROVE" });
    const approved = await corporateService.getBookingApprovalGate(admin.id, booking.id);
    assert.equal(approved.approvalStatus, "APPROVED");
    assert.equal(approved.canProceed, true);
    assert.equal(approved.policyEvaluation.withinPolicy, false);
  });

  it("update/remove membership and company booking list isolation", async () => {
    const admin = await createUser("vis-admin");
    const member = await createUser("vis-member");
    const stranger = await createUser("vis-stranger");
    const company = await corporateService.createCompany(admin.id, {
      name: `Vis Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(admin.id, company.id, {
      name: "Open",
      maxAmountMinor: 1_000_000,
    });
    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });

    const promoted = await corporateService.updateMember(admin.id, company.id, member.id, {
      role: "APPROVER",
      department: "Sales",
    });
    assert.equal(promoted.role, "APPROVER");
    assert.equal(promoted.department, "Sales");

    const snap = await createSnapshot(member.id, 10000);
    const booking = await bookingsService.createQuote(member.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });

    const adminList = await corporateService.listCompanyBookings(admin.id, company.id);
    assert.ok(adminList.items.some((b) => b.id === booking.id));

    await assert.rejects(
      () => corporateService.listCompanyBookings(stranger.id, company.id),
      (err) => err.statusCode === 403,
    );

    await corporateService.updateMember(admin.id, company.id, member.id, {
      role: "MEMBER",
    });
    await corporateService.removeMember(admin.id, company.id, member.id);
    const members = await corporateService.listMembers(admin.id, company.id);
    assert.equal(members.every((m) => m.userId !== member.id), true);
  });

  it("policy update by ADMIN changes deterministic evaluation", async () => {
    const admin = await createUser("polupd");
    const company = await corporateService.createCompany(admin.id, {
      name: `PolUpd Co ${suffix}`,
      creditLimitMinor: 1_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    const policy = await corporateService.createPolicy(admin.id, company.id, {
      name: "V1",
      maxAmountMinor: 100,
      maxCabin: "ECONOMY",
    });
    let ev = await corporateService.evaluatePolicy({
      companyId: company.id,
      amountMinor: 500,
      cabin: "ECONOMY",
    });
    assert.equal(ev.withinPolicy, false);

    await corporateService.updatePolicy(admin.id, company.id, policy.id, {
      maxAmountMinor: 10_000,
    });
    ev = await corporateService.evaluatePolicy({
      companyId: company.id,
      amountMinor: 500,
      cabin: "ECONOMY",
    });
    assert.equal(ev.withinPolicy, true);
  });

  it("CHANGES_REQUESTED keeps booking blocked; within-policy auto-APPROVE can proceed", async () => {
    const admin = await createUser("chg-req");
    const company = await corporateService.createCompany(admin.id, {
      name: `Chg Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(admin.id, company.id, {
      name: "Tight",
      maxAmountMinor: 50,
    });
    const snap = await createSnapshot(admin.id, 10000);
    const booking = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    const pending = await corporateService.createApprovalRequest(admin.id, {
      bookingId: booking.id,
      companyId: company.id,
    });
    await corporateService.decideApproval(admin.id, pending.id, {
      decision: "CHANGES_REQUESTED",
      note: "lower cabin",
    });
    const gate = await corporateService.getBookingApprovalGate(admin.id, booking.id);
    assert.equal(gate.approvalStatus, "PENDING");
    assert.equal(gate.canProceed, false);
    await assert.rejects(
      () =>
        corporateService.assertCorporateBookingAllowed({
          userId: admin.id,
          companyId: company.id,
          bookingId: booking.id,
          amountMinor: booking.amountMinor,
          currency: "USD",
          cabin: "ECONOMY",
        }),
      (err) => err.statusCode === 409 && err.code === "APPROVAL_PENDING",
    );

    // Within-policy path auto-approves (separate booking).
    await corporateService.updatePolicy(admin.id, company.id, (
      await corporateService.listPolicies(admin.id, company.id)
    )[0].id, { maxAmountMinor: 1_000_000 });
    const snap2 = await createSnapshot(admin.id, 10000);
    const bookingOk = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap2.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    const auto = await corporateService.createApprovalRequest(admin.id, {
      bookingId: bookingOk.id,
      companyId: company.id,
    });
    assert.equal(auto.status, "APPROVED");
    const okGate = await corporateService.getBookingApprovalGate(admin.id, bookingOk.id);
    assert.equal(okGate.approvalStatus, "APPROVED");
    assert.equal(okGate.canProceed, true);
    assert.equal(okGate.policyEvaluation.withinPolicy, true);
  });

  it("MEMBER listCompanyBookings is limited to own bookings", async () => {
    const admin = await createUser("own-admin");
    const member = await createUser("own-member");
    const company = await corporateService.createCompany(admin.id, {
      name: `Own Co ${suffix}`,
      creditLimitMinor: 5_000_000,
      currency: "USD",
    }, FINANCE_PERMS);
    companies.push(company.id);
    await corporateService.createPolicy(admin.id, company.id, {
      name: "Open",
      maxAmountMinor: 1_000_000,
    });
    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });

    const snapAdmin = await createSnapshot(admin.id, 10000);
    const adminBooking = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapAdmin.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    const snapMember = await createSnapshot(member.id, 10000);
    const memberBooking = await bookingsService.createQuote(member.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapMember.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });

    const memberList = await corporateService.listCompanyBookings(member.id, company.id);
    assert.ok(memberList.items.every((b) => b.userId === member.id));
    assert.ok(memberList.items.some((b) => b.id === memberBooking.id));
    assert.equal(memberList.items.some((b) => b.id === adminBooking.id), false);
  });
});

describe("Module 06 — financial authorization (credit / markup)", () => {
  it("ordinary user can self-service create company with zero credit and no markup", async () => {
    const user = await createUser("fin-self");
    const company = await corporateService.createCompany(
      user.id,
      { name: `Self Co ${suffix}-z`, currency: "USD" },
      null,
    );
    companies.push(company.id);
    assert.equal(company.creditLimitMinor, 0);
    assert.equal(company.markupBps, null);

    const membership = await prisma.companyMembership.findFirst({
      where: { companyId: company.id, userId: user.id },
    });
    assert.equal(membership?.role, "ADMIN");
  });

  it("ordinary user cannot self-assign credit on create", async () => {
    const user = await createUser("fin-credit");
    await assert.rejects(
      () =>
        corporateService.createCompany(
          user.id,
          { name: `Hack Credit ${suffix}`, creditLimitMinor: 5_000_000 },
          null,
        ),
      (err) => err.statusCode === 403 && /corporate:company:write/i.test(err.message),
    );
  });

  it("ordinary user cannot self-assign markup on create", async () => {
    const user = await createUser("fin-markup");
    await assert.rejects(
      () =>
        corporateService.createCompany(
          user.id,
          { name: `Hack Markup ${suffix}`, markupBps: 900 },
          null,
        ),
      (err) => err.statusCode === 403 && /corporate:company:write/i.test(err.message),
    );
  });

  it("authorized finance permission can set credit and markup on create", async () => {
    const user = await createUser("fin-ok");
    const company = await corporateService.createCompany(
      user.id,
      {
        name: `Financed Co ${suffix}`,
        creditLimitMinor: 2_500_000,
        markupBps: 600,
        currency: "USD",
      },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    assert.equal(company.creditLimitMinor, 2_500_000);
    assert.equal(company.markupBps, 600);
  });

  it("company ADMIN without finance permission cannot escalate credit after create", async () => {
    const user = await createUser("fin-escal");
    const company = await corporateService.createCompany(
      user.id,
      { name: `Escal Co ${suffix}` },
      null,
    );
    companies.push(company.id);
    assert.equal(company.creditLimitMinor, 0);

    await assert.rejects(
      () =>
        corporateService.updateCompany(user.id, company.id, {
          creditLimitMinor: 9_999_999,
        }),
      (err) => err.statusCode === 403,
    );
  });

  it("IDOR: stranger cannot update another company even with finance permission", async () => {
    const owner = await createUser("fin-owner");
    const stranger = await createUser("fin-stranger");
    const company = await corporateService.createCompany(
      owner.id,
      { name: `Idor Co ${suffix}`, creditLimitMinor: 100_000 },
      FINANCE_PERMS,
    );
    companies.push(company.id);

    await assert.rejects(
      () =>
        corporateService.updateCompany(
          stranger.id,
          company.id,
          { creditLimitMinor: 200_000 },
          FINANCE_PERMS,
        ),
      (err) => err.statusCode === 403,
    );
  });
});

describe("Module 06 — project codes", () => {
  it("authorized corporate admin can create a project code", async () => {
    const admin = await createUser("pc-admin");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Co ${suffix}-a` },
      null,
    );
    companies.push(company.id);

    const created = await corporateService.createProjectCode(admin.id, company.id, {
      code: "proj-1042",
      name: "Q3 kickoff",
    });
    assert.equal(created.code, "PROJ-1042");
    assert.equal(created.name, "Q3 kickoff");
    assert.equal(created.isActive, true);
    assert.equal(created.companyId, company.id);
  });

  it("unauthorized member cannot manage project codes", async () => {
    const admin = await createUser("pc-adm2");
    const member = await createUser("pc-mem");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Co ${suffix}-b` },
      null,
    );
    companies.push(company.id);
    await corporateService.addMember(admin.id, company.id, {
      userId: member.id,
      role: "MEMBER",
    });

    await assert.rejects(
      () =>
        corporateService.createProjectCode(member.id, company.id, {
          code: "BLOCKED",
          name: "Nope",
        }),
      (err) => err.statusCode === 403,
    );
  });

  it("user cannot access another company's project codes", async () => {
    const a = await createUser("pc-a");
    const b = await createUser("pc-b");
    const coA = await corporateService.createCompany(a.id, { name: `PC A ${suffix}` }, null);
    const coB = await corporateService.createCompany(b.id, { name: `PC B ${suffix}` }, null);
    companies.push(coA.id, coB.id);
    const pc = await corporateService.createProjectCode(a.id, coA.id, {
      code: "ONLY-A",
      name: "A only",
    });

    await assert.rejects(
      () => corporateService.listProjectCodes(b.id, coA.id),
      (err) => err.statusCode === 403,
    );
    await assert.rejects(
      () =>
        corporateService.updateProjectCode(b.id, coA.id, pc.id, { name: "Hijack" }),
      (err) => err.statusCode === 403,
    );
  });

  it("duplicate code within the same company is rejected; same code in different companies is allowed", async () => {
    const a = await createUser("pc-dup-a");
    const b = await createUser("pc-dup-b");
    const coA = await corporateService.createCompany(a.id, { name: `PC DupA ${suffix}` }, null);
    const coB = await corporateService.createCompany(b.id, { name: `PC DupB ${suffix}` }, null);
    companies.push(coA.id, coB.id);

    await corporateService.createProjectCode(a.id, coA.id, {
      code: "SHARED",
      name: "A",
    });
    await assert.rejects(
      () =>
        corporateService.createProjectCode(a.id, coA.id, {
          code: "shared",
          name: "A2",
        }),
      (err) => err.statusCode === 409,
    );
    const other = await corporateService.createProjectCode(b.id, coB.id, {
      code: "SHARED",
      name: "B",
    });
    assert.equal(other.code, "SHARED");
    assert.equal(other.companyId, coB.id);
  });

  it("inactive project codes cannot be newly selected for bookings", async () => {
    const admin = await createUser("pc-inact");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Inact ${suffix}` },
      null,
    );
    companies.push(company.id);
    const pc = await corporateService.createProjectCode(admin.id, company.id, {
      code: "OLD",
      name: "Retired",
    });
    await corporateService.updateProjectCode(admin.id, company.id, pc.id, {
      isActive: false,
    });

    await assert.rejects(
      () => corporateService.resolveActiveProjectCode(company.id, pc.id),
      (err) => err.statusCode === 400 && /inactive/i.test(err.message),
    );

    const snapshot = await createSnapshot(admin.id);
    await assert.rejects(
      () =>
        bookingsService.createQuote(admin.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snapshot.id,
          route: "ISB-JED",
          cabin: "ECONOMY",
          metadata: { companyId: company.id, projectCodeId: pc.id },
        }),
      (err) => err.statusCode === 400 && /inactive/i.test(err.message),
    );
  });

  it("corporate booking can reference a valid project code; foreign code cannot attach", async () => {
    const admin = await createUser("pc-book");
    const other = await createUser("pc-other");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Book ${suffix}` },
      null,
    );
    const otherCo = await corporateService.createCompany(
      other.id,
      { name: `PC Other ${suffix}` },
      null,
    );
    companies.push(company.id, otherCo.id);
    const pc = await corporateService.createProjectCode(admin.id, company.id, {
      code: "ALPHA",
      name: "Alpha",
    });
    const foreign = await corporateService.createProjectCode(other.id, otherCo.id, {
      code: "FOREIGN",
      name: "Foreign",
    });

    const snapshot = await createSnapshot(admin.id);
    const booking = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, projectCodeId: pc.id },
    });
    assert.equal(booking.metadata.companyId, company.id);
    assert.equal(booking.metadata.projectCodeId, pc.id);
    assert.equal(booking.metadata.projectCode, "ALPHA");

    await assert.rejects(
      () =>
        bookingsService.createQuote(admin.id, {
          product: "FLIGHT",
          currency: "USD",
          supplierOfferSnapshotId: snapshot.id,
          route: "ISB-JED",
          cabin: "ECONOMY",
          metadata: { companyId: company.id, projectCodeId: foreign.id },
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("personal booking remains unaffected by project code metadata", async () => {
    const user = await createUser("pc-personal");
    const admin = await createUser("pc-personal-admin");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Pers ${suffix}` },
      null,
    );
    companies.push(company.id);
    const pc = await corporateService.createProjectCode(admin.id, company.id, {
      code: "PERS",
      name: "Should strip",
    });
    const snapshot = await createSnapshot(user.id);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { projectCodeId: pc.id, projectCode: "FORGED" },
    });
    assert.equal(booking.metadata?.companyId, undefined);
    assert.equal(booking.metadata?.projectCodeId, undefined);
    assert.equal(booking.metadata?.projectCode, undefined);
  });

  it("setBookingProjectCode enforces ownership and company scope", async () => {
    const admin = await createUser("pc-set");
    const stranger = await createUser("pc-set-stranger");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `PC Set ${suffix}` },
      null,
    );
    companies.push(company.id);
    const pc = await corporateService.createProjectCode(admin.id, company.id, {
      code: "SETME",
      name: "Set me",
    });
    const snapshot = await createSnapshot(admin.id);
    const booking = await bookingsService.createQuote(admin.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id },
    });

    const updated = await corporateService.setBookingProjectCode(
      admin.id,
      booking.id,
      pc.id,
    );
    assert.equal(updated.metadata.projectCode, "SETME");

    await assert.rejects(
      () => corporateService.setBookingProjectCode(stranger.id, booking.id, pc.id),
      (err) => err.statusCode === 403,
    );
  });
});

describe("Module 06 — corporate invoicing", () => {
  async function quoteCorporate(userId, companyId, netMinor = 10000, extraMeta = {}) {
    const snap = await createSnapshot(userId, netMinor);
    return bookingsService.createQuote(userId, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId, cabin: "ECONOMY", ...extraMeta },
    });
  }

  async function markReserved(bookingId) {
    return prisma.booking.update({
      where: { id: bookingId },
      data: { status: "RESERVED" },
      select: { id: true, status: true, amountMinor: true, currency: true, netMinor: true, marginMinor: true },
    });
  }

  it("authorized admin can issue and view invoice from authoritative booking amounts", async () => {
    const admin = await createUser("inv-admin");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-a`, billingCycle: "MONTHLY" },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    const pc = await corporateService.createProjectCode(admin.id, company.id, {
      code: "INVPC",
      name: "Invoice project",
    });
    const quoted = await quoteCorporate(admin.id, company.id, 10000, {
      projectCodeId: pc.id,
    });
    // Re-attach via set if quote already resolved project
    if (!quoted.metadata?.projectCode) {
      await corporateService.setBookingProjectCode(admin.id, quoted.id, pc.id);
    }
    const reserved = await markReserved(quoted.id);

    const invoice = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: reserved.id,
    });
    assert.equal(invoice.amountMinor, reserved.amountMinor);
    assert.equal(invoice.netMinor, reserved.netMinor ?? quoted.netMinor);
    assert.equal(invoice.currency, "USD");
    assert.equal(invoice.billingCycle, "MONTHLY");
    assert.equal(invoice.projectCode, "INVPC");
    assert.match(invoice.invoiceNumber, /^INV-/);
    assert.ok(["ISSUED", "PAID"].includes(invoice.status));

    const listed = await invoiceService.listInvoices(admin.id, company.id);
    assert.ok(listed.items.some((i) => i.id === invoice.id));

    const pdf = await invoiceService.getInvoicePdf(admin.id, company.id, invoice.id);
    assert.equal(pdf.contentType, "application/pdf");
    assert.ok(pdf.contentBase64.length > 20);
    assert.equal(pdf.contentBase64.includes("paymentMethodToken"), false);
  });

  it("unauthorized user cannot access another company's invoice; personal cannot manage", async () => {
    const admin = await createUser("inv-own");
    const stranger = await createUser("inv-str");
    const personal = await createUser("inv-pers");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-b` },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    const quoted = await quoteCorporate(admin.id, company.id);
    await markReserved(quoted.id);
    const invoice = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: quoted.id,
    });

    await assert.rejects(
      () => invoiceService.listInvoices(stranger.id, company.id),
      (err) => err.statusCode === 403,
    );
    await assert.rejects(
      () => invoiceService.getInvoice(stranger.id, company.id, invoice.id),
      (err) => err.statusCode === 403,
    );
    await assert.rejects(
      () =>
        invoiceService.issueInvoice(personal.id, company.id, { bookingId: quoted.id }),
      (err) => err.statusCode === 403,
    );
  });

  it("client cannot manipulate invoice total or company ownership", async () => {
    const admin = await createUser("inv-forge");
    const other = await createUser("inv-forge-o");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-c` },
      FINANCE_PERMS,
    );
    const otherCo = await corporateService.createCompany(
      other.id,
      { name: `Inv Co ${suffix}-c2` },
      FINANCE_PERMS,
    );
    companies.push(company.id, otherCo.id);
    const quoted = await quoteCorporate(admin.id, company.id, 8000);
    await markReserved(quoted.id);

    const invoice = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: quoted.id,
      amountMinor: 1, // ignored — not in schema path; service only reads bookingId
    });
    assert.equal(invoice.amountMinor, Math.round(8000 * 1.09));
    assert.notEqual(invoice.amountMinor, 1);

    await assert.rejects(
      () =>
        invoiceService.issueInvoice(admin.id, otherCo.id, { bookingId: quoted.id }),
      (err) => err.statusCode === 403,
    );
  });

  it("invoice numbers are unique under concurrent issuance", async () => {
    const admin = await createUser("inv-conc");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-d` },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    const a = await quoteCorporate(admin.id, company.id, 10000);
    const b = await quoteCorporate(admin.id, company.id, 11000);
    await markReserved(a.id);
    await markReserved(b.id);

    const [i1, i2] = await Promise.all([
      invoiceService.issueInvoice(admin.id, company.id, { bookingId: a.id }),
      invoiceService.issueInvoice(admin.id, company.id, { bookingId: b.id }),
    ]);
    assert.notEqual(i1.invoiceNumber, i2.invoiceNumber);
    assert.notEqual(i1.id, i2.id);
  });

  it("quoted booking cannot be invoiced; re-issue is idempotent", async () => {
    const admin = await createUser("inv-quote");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-e` },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    const quoted = await quoteCorporate(admin.id, company.id);
    await assert.rejects(
      () => invoiceService.issueInvoice(admin.id, company.id, { bookingId: quoted.id }),
      (err) => err.statusCode === 409,
    );
    await markReserved(quoted.id);
    const first = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: quoted.id,
    });
    const second = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: quoted.id,
    });
    assert.equal(first.id, second.id);
    assert.equal(first.invoiceNumber, second.invoiceNumber);
  });

  it("PDF excludes payment tokens; PAID when CAPTURED payment exists", async () => {
    const admin = await createUser("inv-pay");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Inv Co ${suffix}-f` },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    const quoted = await quoteCorporate(admin.id, company.id);
    await markReserved(quoted.id);
    await prisma.payment.create({
      data: {
        userId: admin.id,
        bookingId: quoted.id,
        status: "CAPTURED",
        provider: "CORPORATE_CREDIT",
        currency: "USD",
        amountMinor: quoted.amountMinor,
        paymentMethodToken: "pm_secret_should_never_appear",
      },
    });
    const invoice = await invoiceService.issueInvoice(admin.id, company.id, {
      bookingId: quoted.id,
    });
    assert.equal(invoice.status, "PAID");
    const pdf = await invoiceService.getInvoicePdf(admin.id, company.id, invoice.id);
    const decoded = Buffer.from(pdf.contentBase64, "base64").toString("latin1");
    assert.equal(decoded.includes("pm_secret_should_never_appear"), false);
    assert.equal(JSON.stringify(invoice).includes("pm_secret"), false);
  });
});

describe("Module 06 — corporate credit release", () => {
  async function setupCorporateReservedWithCredit({ label, creditLimitMinor = 5_000_000, netMinor = 10000 }) {
    const user = await createUser(label);
    const company = await corporateService.createCompany(
      user.id,
      {
        name: `CreditRel ${label} ${suffix}`,
        creditLimitMinor,
        currency: "USD",
      },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Any",
      maxCabin: "ECONOMY",
      maxAmountMinor: 10_000_000,
    });
    const snap = await createSnapshot(user.id, netMinor);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "RESERVED" },
    });
    await prisma.bookingTransition.create({
      data: {
        bookingId: booking.id,
        fromStatus: "QUOTED",
        toStatus: "RESERVED",
        actor: "CUSTOMER",
        actorUserId: user.id,
        reason: "test reserve for credit release",
      },
    });

    const consumed = await corporateService.consumeCredit(company.id, booking.amountMinor, {
      actorUserId: user.id,
      bookingId: booking.id,
    });
    assert.equal(consumed.consumed, true);

    const afterConsume = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(afterConsume.creditUsedMinor, booking.amountMinor);

    return { user, company, booking };
  }

  it("cancel releases previously consumed corporate credit", async () => {
    const { user, company, booking } = await setupCorporateReservedWithCredit({
      label: "cancel-rel",
    });

    const cancelled = await bookingsService.cancelBooking(user.id, booking.id, {
      reason: "trip cancelled",
    });
    assert.equal(cancelled.status, "CANCELLED");

    const companyAfter = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(companyAfter.creditUsedMinor, 0);

    const row = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { metadata: true },
    });
    assert.ok(row.metadata.corporateCredit.releasedAt);
    assert.equal(row.metadata.corporateCredit.releasedMinor, booking.amountMinor);

    const audits = await prisma.auditLog.findMany({
      where: { action: "corporate.credit.release", resourceId: booking.id },
    });
    assert.ok(audits.length >= 1);
  });

  it("refund (REFUNDED terminal) releases consumed credit once", async () => {
    const { user, company, booking } = await setupCorporateReservedWithCredit({
      label: "refund-rel",
      netMinor: 12000,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "TICKETED" },
    });
    await prisma.bookingTransition.create({
      data: {
        bookingId: booking.id,
        fromStatus: "RESERVED",
        toStatus: "TICKETED",
        actor: "CUSTOMER",
        actorUserId: user.id,
        reason: "test ticket",
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "REFUNDED" },
    });
    await prisma.bookingTransition.create({
      data: {
        bookingId: booking.id,
        fromStatus: "TICKETED",
        toStatus: "REFUNDED",
        actor: "AGENT",
        actorUserId: user.id,
        reason: "test refund complete",
      },
    });

    const first = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_refunded",
    });
    assert.equal(first.released, true);
    assert.equal(first.amountMinor, booking.amountMinor);

    const companyAfter = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(companyAfter.creditUsedMinor, 0);

    const second = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_refunded",
    });
    assert.equal(second.deduplicated, true);
    assert.equal(second.released, false);

    const companyFinal = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(companyFinal.creditUsedMinor, 0);
  });

  it("duplicate cancel/release does not double-release", async () => {
    const { user, company, booking } = await setupCorporateReservedWithCredit({
      label: "dup-rel",
    });

    await bookingsService.cancelBooking(user.id, booking.id, { reason: "first cancel" });
    const mid = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(mid.creditUsedMinor, 0);

    const again = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_cancelled",
    });
    assert.equal(again.deduplicated, true);
    assert.equal(again.released, false);

    const end = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(end.creditUsedMinor, 0);

    await assert.rejects(
      () => bookingsService.cancelBooking(user.id, booking.id, { reason: "again" }),
      (err) => err.statusCode === 400 || err.statusCode === 409,
    );
  });

  it("personal booking cancel releases nothing", async () => {
    const user = await createUser("pers-rel");
    const company = await corporateService.createCompany(
      user.id,
      { name: `PersRel Co ${suffix}`, creditLimitMinor: 1_000_000, currency: "USD" },
      FINANCE_PERMS,
    );
    companies.push(company.id);

    const snap = await createSnapshot(user.id, 8000);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { cabin: "ECONOMY" },
    });
    assert.equal(booking.metadata?.companyId, undefined);

    const before = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(before.creditUsedMinor, 0);

    await bookingsService.cancelBooking(user.id, booking.id, { reason: "personal cancel" });

    const after = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(after.creditUsedMinor, 0);

    const release = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_cancelled",
    });
    assert.equal(release.reason, "not_corporate");
    assert.equal(release.released, false);
  });

  it("cross-company isolation: release only affects booking company", async () => {
    const a = await setupCorporateReservedWithCredit({ label: "iso-a", netMinor: 10000 });
    const b = await setupCorporateReservedWithCredit({ label: "iso-b", netMinor: 15000 });

    const usedBBefore = (
      await prisma.company.findUnique({
        where: { id: b.company.id },
        select: { creditUsedMinor: true },
      })
    ).creditUsedMinor;
    assert.equal(usedBBefore, b.booking.amountMinor);

    await bookingsService.cancelBooking(a.user.id, a.booking.id, { reason: "iso cancel" });

    const coA = await prisma.company.findUnique({
      where: { id: a.company.id },
      select: { creditUsedMinor: true },
    });
    const coB = await prisma.company.findUnique({
      where: { id: b.company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(coA.creditUsedMinor, 0);
    assert.equal(coB.creditUsedMinor, usedBBefore);
  });

  it("forged client amount/companyId cannot change release amount", async () => {
    const { user, company, booking } = await setupCorporateReservedWithCredit({
      label: "forge-amt",
      netMinor: 10000,
    });
    const other = await corporateService.createCompany(
      user.id,
      { name: `ForgeOther ${suffix}`, creditLimitMinor: 9_999_999, currency: "USD" },
      FINANCE_PERMS,
    );
    companies.push(other.id);
    await prisma.company.update({
      where: { id: other.id },
      data: { creditUsedMinor: 500 },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    const expected = booking.amountMinor;
    const result = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_cancelled",
      // forged — must be ignored by implementation
      amountMinor: 1,
      companyId: other.id,
    });
    assert.equal(result.released, true);
    assert.equal(result.amountMinor, expected);
    assert.equal(result.companyId, company.id);

    const co = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    const otherAfter = await prisma.company.findUnique({
      where: { id: other.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(co.creditUsedMinor, 0);
    assert.equal(otherAfter.creditUsedMinor, 500);
  });

  it("partial refund semantics: no partial credit hold — full consumed amount released on REFUNDED", async () => {
    const { user, company, booking } = await setupCorporateReservedWithCredit({
      label: "partial-rel",
      netMinor: 20000,
    });
    const consumed = booking.amountMinor;
    assert.ok(consumed > 1000);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "REFUNDED" },
    });

    // Even if a partial refundableMinor existed, release uses consumedMinor only.
    const result = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_refunded",
      refundableMinor: 1000,
    });
    assert.equal(result.released, true);
    assert.equal(result.amountMinor, consumed);
    assert.notEqual(result.amountMinor, 1000);

    const co = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(co.creditUsedMinor, 0);
  });

  it("already-released credit cannot release again; QUOTED corporate cancel never consumed", async () => {
    const user = await createUser("quoted-rel");
    const company = await corporateService.createCompany(
      user.id,
      { name: `QuotedRel ${suffix}`, creditLimitMinor: 1_000_000, currency: "USD" },
      FINANCE_PERMS,
    );
    companies.push(company.id);
    await corporateService.createPolicy(user.id, company.id, {
      name: "Any",
      maxAmountMinor: 10_000_000,
    });
    const snap = await createSnapshot(user.id, 9000);
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snap.id,
      route: "ISB-JED",
      cabin: "ECONOMY",
      metadata: { companyId: company.id, cabin: "ECONOMY" },
    });
    await corporateService.createApprovalRequest(user.id, {
      bookingId: booking.id,
      companyId: company.id,
    });

    await bookingsService.cancelBooking(user.id, booking.id, { reason: "never reserved" });
    const co = await prisma.company.findUnique({
      where: { id: company.id },
      select: { creditUsedMinor: true },
    });
    assert.equal(co.creditUsedMinor, 0);

    const noop = await corporateService.releaseCreditForBooking(booking.id, {
      actorUserId: user.id,
      reason: "booking_cancelled",
    });
    assert.equal(noop.released, false);
    assert.ok(noop.reason === "never_consumed" || noop.reason === "already_released" || noop.reason === "not_corporate" || noop.amountMinor === 0);
  });
});

/**
 * P3-03 white-label / expenses / carbon — isolation, honest providers, no secrets.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.FLIGHTONE_API_LISTEN = "false";
process.env.CORPORATE_DOMAIN_VERIFY_PROVIDER = "unconfigured";
process.env.CORPORATE_SSO_PROVIDER = "unconfigured";
process.env.EXPENSE_OCR_PROVIDER = "unconfigured";
process.env.EXPENSE_FINANCE_EXPORT_PROVIDER = "unconfigured";
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
const corporateService = await import("./corporate.service.js");
const portal = await import("./corporate.portal.js");
const expenses = await import("./corporate.expenses.js");
const carbon = await import("./corporate.carbon.js");

const suffix = Date.now();
const userIds = [];
const companyIds = [];
const FINANCE_PERMS = { global: ["corporate:company:write"], byCompany: {} };

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.p303.${label}.${suffix}@example.com`,
      name: `P303 ${label}`,
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
        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }
        resolve({ status: res.status, body: json });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of companyIds) {
    await prisma.expense.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.carbonEstimate.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.perDiemPolicy.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.companyPortal.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("white-label portal", () => {
  it("rejects unauthenticated branding access", async () => {
    const res = await httpRequest("GET", "/api/v1/corporate/companies/x/portal");
    assert.equal(res.status, 401);
  });

  it("isolates branding and never returns SSO secrets or verified domains without a provider", async () => {
    const admin = await createUser("portal-a");
    const other = await createUser("portal-b");
    const a = await corporateService.createCompany(
      admin.id,
      { name: `Portal A ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    const b = await corporateService.createCompany(
      other.id,
      { name: `Portal B ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    companyIds.push(a.id, b.id);

    const saved = await portal.updateCompanyBranding(admin.id, a.id, {
      portalName: "Acme Travel",
      primaryColor: "#112233",
      portalEnabled: true,
    });
    assert.equal(saved.branding.portalName, "Acme Travel");
    assert.equal(saved.branding.primaryColor, "#112233");

    await portal.updateCompanySso(admin.id, a.id, {
      providerType: "oidc",
      issuer: "https://idp.example",
      clientId: "client-a",
      clientSecret: "super-secret-value",
      enabled: true,
    });
    const view = await portal.getCompanyPortal(admin.id, a.id);
    const blob = JSON.stringify(view);
    assert.equal(view.sso.hasClientSecret, true);
    assert.equal(blob.includes("super-secret-value"), false);
    assert.equal(blob.includes("ssoClientSecretEnc"), false);
    assert.equal(view.sso.enabled, false);
    assert.equal(view.sso.status, "UNCONFIGURED");

    const domain = await portal.configureCustomDomain(admin.id, a.id, {
      hostname: `acme-${suffix}.example.com`,
    });
    assert.equal(domain.domain.status, "PENDING");
    const checked = await portal.verifyCustomDomain(admin.id, a.id);
    assert.notEqual(checked.domain.status, "VERIFIED");
    assert.match(String(checked.domain.reason), /not configured|will not mark/i);

    await assert.rejects(
      () => portal.getCompanyPortal(other.id, a.id),
      (err) => err.statusCode === 403,
    );

    const start = await httpRequest("POST", `/api/v1/corporate/companies/${a.id}/portal/sso/start`, {
      headers: authHeader(admin),
    });
    assert.equal(start.status, 503);
    assert.equal(JSON.stringify(start.body).includes("super-secret"), false);
    assert.equal(JSON.stringify(start.body).toLowerCase().includes("prisma"), false);
  });
});

describe("expenses", () => {
  it("creates, isolates, blocks self-approval, and keeps OCR/export honest", async () => {
    const admin = await createUser("exp-admin");
    const member = await createUser("exp-member");
    const outsider = await createUser("exp-out");
    const company = await corporateService.createCompany(
      admin.id,
      { name: `Exp Co ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    const otherCo = await corporateService.createCompany(
      outsider.id,
      { name: `Exp Other ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    companyIds.push(company.id, otherCo.id);
    await corporateService.addMember(admin.id, company.id, { userId: member.id, role: "MEMBER" });

    const quote = await expenses.quotePerDiem(member.id, company.id, { days: 2 });
    assert.equal(quote.configured, false);

    await assert.rejects(
      () =>
        expenses.createExpense(member.id, company.id, {
          amountMinor: 1000,
          category: "PER_DIEM",
          currency: "USD",
        }),
      (err) => err.statusCode === 400,
    );

    await expenses.upsertPerDiemPolicy(admin.id, company.id, {
      dailyAmountMinor: 5000,
      currency: "USD",
      name: "Standard",
    });
    const perDiem = await expenses.createExpense(member.id, company.id, {
      amountMinor: 1,
      category: "PER_DIEM",
      currency: "USD",
      days: 2,
    });
    assert.equal(perDiem.amountMinor, 10000);
    assert.equal(perDiem.perDiemConfigured, true);

    const row = await expenses.createExpense(member.id, company.id, {
      amountMinor: 2500,
      currency: "USD",
      category: "MEALS",
      merchant: "Cafe",
    });
    assert.equal(row.status, "DRAFT");
    assert.equal(row.ocrStatus, "UNCONFIGURED");

    const listing = await expenses.listExpenses(outsider.id, otherCo.id);
    assert.equal(listing.items.some((i) => i.id === row.id), false);

    await assert.rejects(
      () => expenses.getExpense(outsider.id, company.id, row.id),
      (err) => err.statusCode === 403 || err.statusCode === 404,
    );

    const booking = await prisma.booking.create({
      data: {
        userId: member.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 80000,
        netMinor: 70000,
        marginMinor: 10000,
        metadata: { companyId: otherCo.id, origin: "LHE", destination: "DXB" },
      },
    });
    await assert.rejects(
      () =>
        expenses.updateExpense(member.id, company.id, row.id, { bookingId: booking.id }),
      (err) => err.statusCode === 403,
    );

    const ownTrip = await prisma.booking.create({
      data: {
        userId: member.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 80000,
        netMinor: 70000,
        marginMinor: 10000,
        metadata: { companyId: company.id, origin: "LHE", destination: "DXB" },
      },
    });
    const linked = await expenses.updateExpense(member.id, company.id, row.id, {
      bookingId: ownTrip.id,
    });
    assert.equal(linked.bookingId, ownTrip.id);

    const tinyPdf = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n").toString("base64");
    const receipt = await expenses.attachReceipt(member.id, company.id, row.id, {
      contentBase64: tinyPdf,
      contentType: "application/pdf",
      originalFilename: "receipt.pdf",
    });
    assert.equal(receipt.ocrStatus, "UNCONFIGURED");
    assert.deepEqual(receipt.ocrExtracted || {}, {});
    assert.equal(receipt.hasReceipt, true);
    assert.equal(JSON.stringify(receipt).includes("receiptStorageKey"), false);

    const submitted = await expenses.submitExpense(member.id, company.id, row.id);
    assert.equal(submitted.status, "PENDING_APPROVAL");

    await assert.rejects(
      () => expenses.decideExpense(member.id, company.id, row.id, { decision: "APPROVE" }),
      (err) => err.statusCode === 403,
    );

    const ownAdminExp = await expenses.createExpense(admin.id, company.id, {
      amountMinor: 100,
      currency: "USD",
      category: "OTHER",
    });
    await expenses.submitExpense(admin.id, company.id, ownAdminExp.id);
    await assert.rejects(
      () => expenses.decideExpense(admin.id, company.id, ownAdminExp.id, { decision: "APPROVE" }),
      (err) => err.statusCode === 403 && /own expense/i.test(err.message),
    );

    const decided = await expenses.decideExpense(admin.id, company.id, row.id, {
      decision: "APPROVE",
    });
    assert.equal(decided.status, "REIMBURSEMENT_PENDING");

    const reimbursed = await expenses.markExpenseReimbursed(admin.id, company.id, row.id);
    assert.equal(reimbursed.status, "REIMBURSED");

    const exported = await expenses.exportReimbursableExpenses(admin.id, company.id);
    assert.equal(exported.submittedExternally, false);
    assert.equal(exported.integration.configured, false);
    assert.ok(exported.contentBase64);
    assert.match(exported.integration.reason, /not configured/i);
  });
});

describe("carbon dashboard isolation", () => {
  it("scopes totals to the company and does not fabricate missing flights", async () => {
    const admin = await createUser("carb-a");
    const other = await createUser("carb-b");
    const a = await corporateService.createCompany(
      admin.id,
      { name: `Carb A ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    const b = await corporateService.createCompany(
      other.id,
      { name: `Carb B ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    companyIds.push(a.id, b.id);

    await prisma.booking.create({
      data: {
        userId: admin.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 50000,
        netMinor: 40000,
        marginMinor: 10000,
        metadata: { companyId: a.id, origin: "LHE", destination: "DXB" },
      },
    });
    await prisma.booking.create({
      data: {
        userId: other.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 90000,
        netMinor: 80000,
        marginMinor: 10000,
        metadata: { companyId: b.id, origin: "LHR", destination: "JFK" },
      },
    });
    await prisma.booking.create({
      data: {
        userId: admin.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "USD",
        amountMinor: 10000,
        netMinor: 9000,
        marginMinor: 1000,
        metadata: { companyId: a.id },
      },
    });

    const dash = await carbon.getCarbonDashboard(admin.id, a.id, {});
    assert.ok(dash.totals.estimatedCount >= 1);
    assert.ok(dash.totals.insufficientCount >= 1);
    assert.equal(dash.breakdown.every((row) => dash.companyId === a.id), true);
    assert.equal(
      dash.breakdown.some((row) => row.status === "AVAILABLE" && row.gramsCo2e > 0),
      true,
    );
    assert.equal(
      dash.breakdown.some((row) => row.status === "INSUFFICIENT_DATA" && row.gramsCo2e == null),
      true,
    );

    await assert.rejects(
      () => carbon.getCarbonDashboard(other.id, a.id, {}),
      (err) => err.statusCode === 403,
    );

    const httpDash = await httpRequest("GET", `/api/v1/corporate/companies/${a.id}/carbon`, {
      headers: authHeader(other),
    });
    assert.equal(httpDash.status, 403);
    assert.equal(JSON.stringify(httpDash.body).toLowerCase().includes("prisma"), false);
  });
});

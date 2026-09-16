/**
 * Module 17 — Management Dashboard integration tests.
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
const { clearSwrCache } = await import("../../lib/swr-cache.js");
const dash = await import("./dashboard.service.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");

const suffix = Date.now();
const userIds = [];
const bookingIds = [];
const searchIds = [];
const conversationIds = [];
const escalationIds = [];
const httpUserIds = [];
let grantedRoleId = null;

const from = new Date(Date.now() - 7 * 86400000);
const to = new Date(Date.now() + 60000);
const range = { from, to };

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.dash.${label}.${suffix}@example.com`,
      name: `Dash ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  clearSwrCache();
});

after(async () => {
  for (const id of escalationIds) {
    await prisma.escalationTicket.delete({ where: { id } }).catch(() => {});
  }
  for (const id of conversationIds) {
    await prisma.message.deleteMany({ where: { conversationId: id } }).catch(() => {});
    await prisma.conversation.delete({ where: { id } }).catch(() => {});
  }
  for (const id of searchIds) {
    await prisma.dashboardSearchEvent.delete({ where: { id } }).catch(() => {});
  }
  for (const id of bookingIds) {
    await prisma.bookingTransition.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { bookingId: id } }).catch(() => {});
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  for (const id of [...userIds, ...httpUserIds]) {
    await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  if (grantedRoleId) {
    await prisma.rolePermission.deleteMany({ where: { roleId: grantedRoleId } }).catch(() => {});
    await prisma.role.delete({ where: { id: grantedRoleId } }).catch(() => {});
  }
  clearSwrCache();
  await prisma.$disconnect();
});

describe("Module 17 Management Dashboard", () => {
  it("sales/revenue/margins from authoritative bookings; no FX mix", async () => {
    clearSwrCache();
    const user = await createUser("rev");
    const b1 = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        status: "TICKETED",
        currency: "USD",
        amountMinor: 10000,
        netMinor: 8000,
        marginMinor: 2000,
        supplierCode: "GALILEO",
        metadata: {},
      },
    });
    bookingIds.push(b1.id);
    await prisma.bookingTransition.create({
      data: {
        bookingId: b1.id,
        fromStatus: "QUOTED",
        toStatus: "TICKETED",
        actor: "SYSTEM",
      },
    });

    const b2 = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "HOTEL",
        status: "CANCELLED",
        currency: "USD",
        amountMinor: 5000,
        netMinor: 4000,
        marginMinor: 1000,
        supplierCode: "RATEHAWK",
        metadata: {},
      },
    });
    bookingIds.push(b2.id);

    const sales = await dash.getSales(range);
    assert.ok(sales.recognizedSales >= 1);
    assert.ok(sales.volumeCreated >= 2);

    const revenue = await dash.getRevenue({ ...range, currency: "USD" });
    assert.equal(revenue.dataStatus, "OK");
    assert.ok(revenue.revenueMinor >= 10000);
    assert.ok(revenue.marginMinor >= 2000);

    const margins = await dash.getMargins({ ...range, currency: "USD" });
    assert.ok(margins.marginMinor >= 2000);
  });

  it("booking conversion uses search events + transitions", async () => {
    clearSwrCache();
    const user = await createUser("conv");
    const s = await dash.recordSearchEvent({
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      resultCount: 3,
      success: true,
    });
    if (s?.id) searchIds.push(s.id);

    const b = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        status: "TICKETED",
        currency: "USD",
        amountMinor: 2000,
        netMinor: 1500,
        marginMinor: 500,
        supplierCode: "GALILEO",
        metadata: {},
      },
    });
    bookingIds.push(b.id);
    await prisma.bookingTransition.create({
      data: { bookingId: b.id, fromStatus: "QUOTED", toStatus: "RESERVED", actor: "CUSTOMER" },
    });
    await prisma.bookingTransition.create({
      data: { bookingId: b.id, fromStatus: "RESERVED", toStatus: "TICKETED", actor: "SYSTEM" },
    });

    const conv = await dash.getBookingConversion(range);
    assert.ok(conv.funnel.quoted >= 1);
    assert.ok(conv.funnel.reachedTicketed >= 1);
    assert.ok(conv.conversion.quotedToTicketed != null);
    if (conv.funnel.searches > 0) {
      assert.ok(conv.conversion.searchToQuote != null);
      assert.equal(conv.searchInstrumentation, "OK");
    }
  });

  it("AI automation uses conversations vs escalations", async () => {
    clearSwrCache();
    const user = await createUser("auto");
    const c1 = await prisma.conversation.create({
      data: { userId: user.id, title: `dash-auto-${suffix}` },
    });
    conversationIds.push(c1.id);
    const c2 = await prisma.conversation.create({
      data: { userId: user.id, title: `dash-auto-esc-${suffix}`, status: "ESCALATED" },
    });
    conversationIds.push(c2.id);
    const esc = await prisma.escalationTicket.create({
      data: {
        conversationId: c2.id,
        userId: user.id,
        trigger: "CUSTOMER_REQUEST",
        priority: 0,
        contextSnapshot: {},
      },
    });
    escalationIds.push(esc.id);

    const auto = await dash.getAutomation(range);
    assert.ok(auto.conversationsTotal >= 2);
    assert.ok(auto.escalatedConversations >= 1);
    assert.ok(auto.automationRate != null);
    assert.ok(auto.automationRate <= 1);
  });

  it("supplier performance and customer analytics are real aggregates", async () => {
    clearSwrCache();
    const suppliers = await dash.getSupplierPerformance(range);
    assert.ok(["OK", "NO_DATA"].includes(suppliers.dataStatus));
    const customers = await dash.getCustomerAnalytics(range);
    assert.ok(customers.usersTotal >= 1);
    assert.ok(customers.bookersInRange >= 0);
  });

  it("operational KPIs and overview compose without inventing", async () => {
    clearSwrCache();
    const ops = await dash.getOperationalKpis(range);
    assert.ok(typeof ops.openEscalations === "number");
    assert.ok(typeof ops.pendingRefunds === "number");

    const overview = await dash.getOverview(range);
    assert.ok(overview.sales);
    assert.ok(overview.revenue);
    assert.ok(overview.bookingConversion);
    assert.ok(overview.aiAutomation);
    assert.ok(overview.supplierPerformance);
    assert.ok(overview.customerAnalytics);
    assert.ok(overview.operationalKpis);
    assert.ok(overview.freshness.computedAt);

    const ava = await dash.buildAvaDashboardGuidance(range);
    assert.match(ava.promptBlock, /MANAGEMENT DASHBOARD/);
    assert.match(ava.promptBlock, /Never invent/);
  });

  it("outstanding credit reports available or UNCONFIGURED honestly", async () => {
    clearSwrCache();
    const credit = await dash.getOutstandingCredit();
    assert.ok(["OK", "NO_DATA", "UNCONFIGURED"].includes(credit.dataStatus) || credit.available === false);
  });

  it("cancelled bookings are not recognized sales", async () => {
    clearSwrCache();
    const user = await createUser("cancel");
    const cancelled = await prisma.booking.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        status: "CANCELLED",
        currency: "EUR",
        amountMinor: 99900,
        netMinor: 90000,
        marginMinor: 9900,
        metadata: {},
      },
    });
    bookingIds.push(cancelled.id);
    const sales = await dash.getSales({ ...range, currency: "EUR" });
    // Recognised sales for EUR-only cancelled fixture should not include this as recognized
    // (may be 0 if no other EUR ticketed bookings).
    const rev = await dash.getRevenue({ ...range, currency: "EUR" });
    assert.ok(rev.revenueMinor === 0 || rev.bookingCount === 0 || rev.revenueMinor < 99900);
    assert.ok(sales.byStatus.some((s) => s.status === "CANCELLED" && s.count >= 1));
  });
});

describe("Module 17 Dashboard HTTP auth", () => {
  function authHeader(user) {
    const token = signAccessToken({ sub: user.id, email: user.email });
    return { Authorization: `Bearer ${token}` };
  }

  function httpRequest(method, path, { headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, async () => {
        const { port } = server.address();
        try {
          const res = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: { Accept: "application/json", ...headers },
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

  it("rejects unauthenticated and unauthorized callers; allows dashboard:read", async () => {
    const qs = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    const unauth = await httpRequest("GET", `/api/v1/dashboard/overview?${qs}`);
    assert.equal(unauth.status, 401);

    const plain = await prisma.user.create({
      data: {
        email: `fo.dash.http-plain.${suffix}@example.com`,
        name: "Dash http-plain",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    httpUserIds.push(plain.id);
    const forbidden = await httpRequest("GET", `/api/v1/dashboard/overview?${qs}`, {
      headers: authHeader(plain),
    });
    assert.equal(forbidden.status, 403);

    const admin = await prisma.user.create({
      data: {
        email: `fo.dash.http-admin.${suffix}@example.com`,
        name: "Dash http-admin",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    httpUserIds.push(admin.id);
    const perm =
      (await prisma.permission.findUnique({ where: { key: "dashboard:read" } })) ||
      (await prisma.permission.create({
        data: { key: "dashboard:read", label: "Dashboard read" },
      }));
    const role = await prisma.role.create({
      data: {
        name: `DashTestRole_${suffix}`,
        description: "Module 17 test role",
      },
    });
    grantedRoleId = role.id;
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: role.id },
    });

    const ok = await httpRequest("GET", `/api/v1/dashboard/overview?${qs}`, {
      headers: authHeader(admin),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body?.success, true);
    assert.ok(ok.body?.data?.sales);
    assert.ok(ok.body?.data?.freshness?.computedAt);
    assert.equal(ok.body?.data?.range?.from != null, true);
  });
});

/**
 * P3-04 advanced analytics — auth, isolation, insufficient vs inferred, no auto price change.
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
const corporateService = await import("../corporate/corporate.service.js");
const advanced = await import("./dashboard.advanced.js");

const suffix = Date.now();
const userIds = [];
const companyIds = [];
const FINANCE_PERMS = { global: ["corporate:company:write"], byCompany: {} };
let grantedRoleId = null;

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.adv.${label}.${suffix}@example.com`,
      name: `Adv ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  userIds.push(user.id);
  return user;
}

function authHeader(user) {
  return { Authorization: `Bearer ${signAccessToken({ sub: user.id, email: user.email })}` };
}

function httpRequest(method, pathName, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
          method,
          headers: { Accept: "application/json", ...headers },
        });
        const json = await res.json().catch(() => null);
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
    await prisma.companyMembership.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  for (const id of userIds) {
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.supplierOfferSnapshot.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  if (grantedRoleId) {
    await prisma.rolePermission.deleteMany({ where: { roleId: grantedRoleId } }).catch(() => {});
    await prisma.role.delete({ where: { id: grantedRoleId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("advanced analytics HTTP", () => {
  it("rejects unauthenticated and unauthorized callers; bounds the query range", async () => {
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const to = new Date().toISOString();
    const unauth = await httpRequest("GET", `/api/v1/dashboard/advanced?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    assert.equal(unauth.status, 401);

    const plain = await createUser("plain");
    const forbidden = await httpRequest(
      "GET",
      `/api/v1/dashboard/advanced?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: authHeader(plain) },
    );
    assert.equal(forbidden.status, 403);

    const wideFrom = new Date(Date.now() - 400 * 86400000).toISOString();
    const admin = await createUser("range");
    const perm =
      (await prisma.permission.findUnique({ where: { key: "dashboard:read" } })) ||
      (await prisma.permission.create({ data: { key: "dashboard:read", label: "Dashboard read" } }));
    const role = await prisma.role.create({
      data: { name: `AdvRole_${suffix}`, description: "advanced analytics test" },
    });
    grantedRoleId = role.id;
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
    const wide = await httpRequest(
      "GET",
      `/api/v1/dashboard/advanced?from=${encodeURIComponent(wideFrom)}&to=${encodeURIComponent(to)}`,
      { headers: authHeader(admin) },
    );
    assert.equal(wide.status, 400);
    assert.equal(JSON.stringify(wide.body).toLowerCase().includes("prisma"), false);

    const malformed = await httpRequest(
      "GET",
      `/api/v1/dashboard/advanced?from=not-a-date&to=${encodeURIComponent(to)}`,
      { headers: authHeader(admin) },
    );
    assert.equal(malformed.status, 400);
    assert.equal(JSON.stringify(malformed.body).toLowerCase().includes("prisma"), false);
  });
});

describe("forecast / elasticity / suppliers", () => {
  it("returns insufficient-data without fabricating values", async () => {
    const user = await createUser("thin");
    const from = new Date(Date.now() - 30 * 86400000);
    const to = new Date();
    const scoped = { from, to, companyId: `empty-${suffix}` };
    const forecast = await advanced.getAdvancedForecast({ ...scoped, metric: "volume" });
    assert.equal(forecast.available, false);
    assert.equal(forecast.forecast, null);
    const elasticity = await advanced.getAdvancedElasticity(scoped);
    assert.equal(elasticity.available, false);
    assert.equal(elasticity.autoPriceChange, false);
    const suppliers = await advanced.getAdvancedSupplierInsights(scoped);
    assert.equal(suppliers.available, false);
    assert.equal(suppliers.autoNegotiate, false);
  });

  it("forecasts from four weekly observations and keeps elasticity non-causal", async () => {
    const user = await createUser("series");
    const companyId = `series-${suffix}`;
    for (let i = 0; i < 5; i += 1) {
      await prisma.booking.create({
        data: {
          userId: user.id,
          product: "FLIGHT",
          status: "TICKETED",
          currency: "USD",
          amountMinor: 10000 + i * 100,
          netMinor: 8000,
          marginMinor: 2000,
          supplierCode: "GALILEO",
          metadata: { companyId, origin: "LHE", destination: "DXB" },
          createdAt: new Date(Date.now() - (4 - i) * 8 * 86400000),
        },
      });
    }
    const from = new Date(Date.now() - 50 * 86400000);
    const to = new Date();
    const forecast = await advanced.getAdvancedForecast({ from, to, metric: "volume", companyId });
    assert.equal(forecast.available, true);
    assert.equal(forecast.status, "INFERENCE");
    assert.equal(forecast.autoAction, false);
    assert.ok(forecast.forecast != null);

    for (let i = 0; i < 6; i += 1) {
      await prisma.supplierOfferSnapshot.create({
        data: {
          userId: user.id,
          product: "FLIGHT",
          supplierCode: "GALILEO",
          supplierOfferId: `ADV-${suffix}-${i}`,
          currency: "USD",
          netMinor: 20000,
          supplierBookingRefs: { itinerary: { origin: "LHE", destination: "DXB" } },
          ttlMs: 60_000,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    const elasticity = await advanced.getAdvancedElasticity({ from, to, companyId });
    assert.equal(elasticity.causal, false);
    assert.equal(elasticity.autoPriceChange, false);
    assert.ok(["INSUFFICIENT_DATA", "INFERENCE"].includes(elasticity.status));

    const suppliers = await advanced.getAdvancedSupplierInsights({ from, to, companyId });
    assert.equal(suppliers.available, true);
    assert.equal(suppliers.autoNegotiate, false);
    assert.ok(suppliers.suppliers.some((s) => s.supplierCode === "GALILEO"));
  });
});

describe("tenant isolation", () => {
  it("keeps company analytics inside the organization and hides them from members", async () => {
    const adminA = await createUser("co-a");
    const memberA = await createUser("mem-a");
    const adminB = await createUser("co-b");
    const a = await corporateService.createCompany(
      adminA.id,
      { name: `Adv Co A ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    const b = await corporateService.createCompany(
      adminB.id,
      { name: `Adv Co B ${suffix}`, currency: "USD" },
      FINANCE_PERMS,
    );
    companyIds.push(a.id, b.id);
    await corporateService.addMember(adminA.id, a.id, { userId: memberA.id, role: "MEMBER" });

    await prisma.booking.create({
      data: {
        userId: adminA.id,
        product: "FLIGHT",
        status: "TICKETED",
        currency: "USD",
        amountMinor: 77777,
        netMinor: 70000,
        marginMinor: 7777,
        supplierCode: "GALILEO",
        metadata: { companyId: a.id, origin: "LHE", destination: "DXB" },
      },
    });
    await prisma.booking.create({
      data: {
        userId: adminB.id,
        product: "FLIGHT",
        status: "TICKETED",
        currency: "USD",
        amountMinor: 11111,
        netMinor: 10000,
        marginMinor: 1111,
        supplierCode: "RATEHAWK",
        metadata: { companyId: b.id, origin: "LHR", destination: "JFK" },
      },
    });

    const from = new Date(Date.now() - 7 * 86400000);
    const to = new Date();
    const dashA = await advanced.getCompanyAdvancedAnalytics(adminA.id, a.id, { from, to });
    assert.equal(dashA.companyId, a.id);
    const spendA = dashA.suppliers.suppliers?.reduce((acc, s) => acc + (s.spendMinor || 0), 0) || 0;
    assert.ok(spendA === 77777);
    assert.equal(JSON.stringify(dashA).includes(adminA.email), false);
    assert.equal(JSON.stringify(dashA).includes(memberA.email), false);
    const spendB = (await advanced.getCompanyAdvancedAnalytics(adminB.id, b.id, { from, to }))
      .suppliers.suppliers?.reduce((acc, s) => acc + (s.spendMinor || 0), 0) || 0;
    assert.equal(spendB, 11111);

    await assert.rejects(
      () => advanced.getCompanyAdvancedAnalytics(adminB.id, a.id, { from, to }),
      (err) => err.statusCode === 403,
    );
    await assert.rejects(
      () => advanced.getCompanyAdvancedAnalytics(memberA.id, a.id, { from, to }),
      (err) => err.statusCode === 403,
    );

    const httpIso = await httpRequest(
      "GET",
      `/api/v1/corporate/companies/${a.id}/analytics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { headers: authHeader(adminB) },
    );
    assert.equal(httpIso.status, 403);
    assert.equal(JSON.stringify(httpIso.body).toLowerCase().includes("prisma"), false);
  });
});

/**
 * Module 03 — HTTP reserve route hardening (client amount never authoritative).
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.ALLOW_SIMULATED_BOOKING = "true";
process.env.ALLOW_SIMULATED_PAYMENT = "true";
process.env.NODE_ENV = "test";

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.http.${label}.${suffix}@example.com`,
      name: `HTTP ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

function authHeader(user) {
  const token = signAccessToken({ sub: user.id, email: user.email });
  return { Authorization: `Bearer ${token}` };
}

function httpRequest(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
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

async function createSnapshot(user) {
  return prisma.supplierOfferSnapshot.create({
    data: {
      userId: user.id,
      product: "FLIGHT",
      supplierCode: "GALILEO",
      supplierOfferId: "SIM-12000",
      currency: "USD",
      netMinor: 12000,
      supplierBookingRefs: {
        booking: {
          transactionId: "t-http-1",
          productRef: "p-http-1",
          flightRefs: ["f-http-1"],
          contentSource: "GDS",
        },
        itinerary: { origin: "ISB", destination: "JED" },
        fare: { brandRef: "BR-HTTP" },
      },
      ttlMs: 60_000,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
  }
  for (const [key, valueInt] of [
    ["default_markup_bps", 900],
    ["flight_default_markup_bps", 900],
  ]) {
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
  if (process.env.ALLOW_SIMULATED_BOOKING === "true") {
    delete process.env.ALLOW_SIMULATED_BOOKING;
  }
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 03 bookings HTTP reserve hardening", () => {
  it("rejects reserve when clientAmountMinor drifts from server quote (409)", async () => {
    const user = await createUser("drift");
    const snapshot = await createSnapshot(user);

    const quoteRes = await httpRequest("POST", "/api/v1/bookings", {
      headers: authHeader(user),
      body: {
        product: "FLIGHT",
        currency: "USD",
        supplierOfferSnapshotId: snapshot.id,
        route: "ISB-JED",
        cabin: "ECONOMY",
      },
    });
    assert.equal(quoteRes.status, 201);
    const bookingId = quoteRes.body.data.id;
    const serverAmount = quoteRes.body.data.amountMinor;

    const reserveRes = await httpRequest("POST", `/api/v1/bookings/${bookingId}/reserve`, {
      headers: authHeader(user),
      body: { clientAmountMinor: serverAmount - 100 },
    });

    assert.equal(reserveRes.status, 409);
    assert.match(reserveRes.body.message, /price changed/i);
  });

  it("allows reserve without clientAmountMinor — server price is authoritative", async () => {
    const user = await createUser("no-client-amount");
    const snapshot = await createSnapshot(user);

    const quoteRes = await httpRequest("POST", "/api/v1/bookings", {
      headers: authHeader(user),
      body: {
        product: "FLIGHT",
        currency: "USD",
        supplierOfferSnapshotId: snapshot.id,
        route: "ISB-JED",
        cabin: "ECONOMY",
      },
    });
    assert.equal(quoteRes.status, 201);
    const bookingId = quoteRes.body.data.id;

    const payRes = await httpRequest("POST", `/api/v1/bookings/${bookingId}/pay`, {
      headers: authHeader(user),
      body: { paymentMethodToken: "pm_test_ok" },
    });
    assert.equal(payRes.status, 200);

    const reserveRes = await httpRequest("POST", `/api/v1/bookings/${bookingId}/reserve`, {
      headers: authHeader(user),
      body: {},
    });

    assert.equal(reserveRes.status, 200);
    assert.equal(reserveRes.body.data.status, "RESERVED");
    assert.equal(reserveRes.body.data.amountMinor, Math.round(12000 * 1.09));
  });

  it("ignores manipulated amountMinor on quote creation", async () => {
    const user = await createUser("quote-manip");
    const snapshot = await createSnapshot(user);

    const quoteRes = await httpRequest("POST", "/api/v1/bookings", {
      headers: authHeader(user),
      body: {
        product: "FLIGHT",
        currency: "USD",
        supplierOfferSnapshotId: snapshot.id,
        route: "ISB-JED",
        cabin: "ECONOMY",
        netMinor: 1,
        amountMinor: 1,
      },
    });

    assert.equal(quoteRes.status, 201);
    assert.equal(quoteRes.body.data.netMinor, 12000);
    assert.equal(quoteRes.body.data.amountMinor, Math.round(12000 * 1.09));
  });
});

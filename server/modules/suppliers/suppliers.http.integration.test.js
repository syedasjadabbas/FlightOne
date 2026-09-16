/**
 * Module 03 — authenticated search persists snapshots; body userId is ignored.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.NODE_ENV = "test";

const TRAVELPORT_ENV_KEYS = [
  "TRAVELPORT_USERNAME",
  "TRAVELPORT_PASSWORD",
  "TRAVELPORT_CLIENT_ID",
  "TRAVELPORT_CLIENT_SECRET",
  "TRAVELPORT_ACCESS_GROUP",
  "TRAVELPORT_PCC",
];
const savedTravelportEnv = {};

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");
const bookingsService = await import("../bookings/bookings.service.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.searchhttp.${label}.${suffix}@example.com`,
      name: `Search HTTP ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
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

const flightBody = {
  product: "FLIGHT",
  query: {
    origin: "ISB",
    destination: "JED",
    departureDate: "2026-12-20",
    cabinClass: "ECONOMY",
  },
};

before(async () => {
  for (const key of TRAVELPORT_ENV_KEYS) {
    savedTravelportEnv[key] = process.env[key];
    delete process.env[key];
  }
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
  for (const key of TRAVELPORT_ENV_KEYS) {
    if (savedTravelportEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedTravelportEnv[key];
  }
  for (const id of users) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 03 search HTTP snapshots", () => {
  it("JWT search persists user-scoped snapshots and returns snapshotId", async () => {
    const user = await createUser("jwt-search");
    const token = signAccessToken({ sub: user.id, email: user.email });
    const res = await httpRequest("POST", "/api/v1/suppliers/search", {
      headers: { Authorization: `Bearer ${token}` },
      body: flightBody,
    });
    assert.equal(res.status, 200);
    const offers = res.body.data.offers;
    assert.ok(offers.length >= 1);
    assert.ok(offers[0].supplierOfferSnapshotId);
    const row = await prisma.supplierOfferSnapshot.findFirst({
      where: { id: offers[0].supplierOfferSnapshotId, userId: user.id },
    });
    assert.ok(row);
    assert.equal(row.netMinor, offers[0].amountMinor);
  });

  it("ignores spoofed body userId and X-FlightOne-User-Id on JWT search", async () => {
    const owner = await createUser("jwt-owner");
    const victim = await createUser("jwt-victim");
    const token = signAccessToken({ sub: owner.id, email: owner.email });
    const res = await httpRequest("POST", "/api/v1/suppliers/search", {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-FlightOne-User-Id": victim.id,
      },
      body: { ...flightBody, userId: victim.id },
    });
    assert.equal(res.status, 200);
    const snapshotId = res.body.data.offers[0].supplierOfferSnapshotId;
    const row = await prisma.supplierOfferSnapshot.findUnique({ where: { id: snapshotId } });
    assert.equal(row.userId, owner.id);
  });

  it("internal key + X-FlightOne-User-Id persists snapshot for that user", async () => {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey) {
      assert.ok(true, "INTERNAL_API_KEY unset — skip trusted-header path");
      return;
    }
    const user = await createUser("internal-header");
    const res = await httpRequest("POST", "/api/v1/suppliers/search", {
      headers: {
        "X-Internal-Api-Key": internalKey,
        "X-FlightOne-User-Id": user.id,
      },
      body: flightBody,
    });
    assert.equal(res.status, 200);
    const snapshotId = res.body.data.offers[0].supplierOfferSnapshotId;
    const row = await prisma.supplierOfferSnapshot.findUnique({ where: { id: snapshotId } });
    assert.equal(row.userId, user.id);
  });

  it("search offer snapshot → quote uses Module 05 price, not client amount", async () => {
    const user = await createUser("quote-from-search");
    const token = signAccessToken({ sub: user.id, email: user.email });
    const searchRes = await httpRequest("POST", "/api/v1/suppliers/search", {
      headers: { Authorization: `Bearer ${token}` },
      body: flightBody,
    });
    const offer = searchRes.body.data.offers[0];
    const booking = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: offer.currency,
      supplierOfferSnapshotId: offer.supplierOfferSnapshotId,
      amountMinor: 1,
      netMinor: 1,
      route: "ISB-JED",
      cabin: "ECONOMY",
    });
    assert.equal(booking.netMinor, offer.amountMinor);
    assert.equal(booking.amountMinor, Math.round(offer.amountMinor * 1.09));
    assert.notEqual(booking.amountMinor, 1);
  });
});

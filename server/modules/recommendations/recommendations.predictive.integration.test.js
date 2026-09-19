/**
 * Phase 3 predictive recommendations — ownership, grounding, fare insight.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.FLIGHTONE_API_LISTEN = "false";
process.env.CALENDAR_PROVIDER = "unconfigured";
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
const predictive = await import("./recommendations.predictive.js");

const suffix = Date.now();
const userIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.pred.${label}.${suffix}@example.com`,
      name: `Pred ${label}`,
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
        const json = await res.json();
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
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.recommendationFeedback.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.predictivePreference.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.supplierOfferSnapshot.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("predictive HTTP", () => {
  it("rejects unauthenticated personal recommendations", async () => {
    const res = await httpRequest("GET", "/api/v1/recommendations/predictive");
    assert.equal(res.status, 401);
  });

  it("rejects unauthenticated dismiss and preference updates", async () => {
    const dismiss = await httpRequest("POST", "/api/v1/recommendations/predictive/dismiss", {
      body: { id: "predictive:ROUTE_PATTERN:LHE-DXB" },
    });
    assert.equal(dismiss.status, 401);
    const prefs = await httpRequest("PATCH", "/api/v1/recommendations/predictive/preferences", {
      body: { proactiveEnabled: false },
    });
    assert.equal(prefs.status, 401);
  });

  it("exposes calendar capability without leaking credentials", async () => {
    const res = await httpRequest("GET", "/api/v1/recommendations/calendar");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.configured, false);
    assert.equal(res.body.data.events.length, 0);
    const blob = JSON.stringify(res.body).toLowerCase();
    assert.equal(blob.includes("api_key"), false);
    assert.equal(blob.includes("secret"), false);
  });

  it("returns an honest empty state with no history", async () => {
    const user = await createUser("empty");
    const res = await httpRequest("GET", "/api/v1/recommendations/predictive", {
      headers: authHeader(user),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.length, 0);
    assert.match(String(res.body.data.emptyReason), /not enough verified/i);
    assert.equal(res.body.data.calendar.configured, false);
    assert.equal(JSON.stringify(res.body).toLowerCase().includes("prisma"), false);
  });

  it("grounds a recommendation in owner history and isolates users", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    await prisma.booking.create({
      data: {
        userId: owner.id,
        status: "COMPLETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 80000,
        netMinor: 70000,
        marginMinor: 10000,
        metadata: { origin: "LHE", destination: "DXB" },
      },
    });
    const mine = await httpRequest("GET", "/api/v1/recommendations/predictive", {
      headers: authHeader(owner),
    });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.items.some((i) => i.origin === "LHE" && i.destination === "DXB"));
    assert.match(mine.body.data.items[0].reason, /previous trips|frequently|upcoming/i);
    assert.ok(!/you travelled to london/i.test(JSON.stringify(mine.body.data).toLowerCase()));

    const theirs = await httpRequest("GET", "/api/v1/recommendations/predictive", {
      headers: authHeader(other),
    });
    assert.equal(theirs.body.data.items.some((i) => i.destination === "DXB"), false);
  });

  it("dismisses a recommendation for the owner only", async () => {
    const user = await createUser("dismiss");
    await prisma.booking.create({
      data: {
        userId: user.id,
        status: "TICKETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 10000,
        netMinor: 9000,
        marginMinor: 1000,
        metadata: { origin: "KHI", destination: "JED" },
      },
    });
    const listed = await httpRequest("GET", "/api/v1/recommendations/predictive", {
      headers: authHeader(user),
    });
    const id = listed.body.data.items[0].id;
    const gone = await httpRequest("POST", "/api/v1/recommendations/predictive/dismiss", {
      headers: authHeader(user),
      body: { id },
    });
    assert.equal(gone.status, 200);
    const again = await predictive.listPredictiveRecommendations(user.id, { notify: false });
    assert.equal(again.items.some((i) => i.id === id), false);
  });
});

describe("fare insight HTTP", () => {
  it("shows current fare and refuses to fabricate a prediction", async () => {
    const res = await httpRequest("POST", "/api/v1/recommendations/fare-insight", {
      body: {
        origin: "LHE",
        destination: "DXB",
        currentAmountMinor: 55000,
        currency: "PKR",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.currentFare.available, true);
    assert.equal(res.body.data.prediction.available, false);
    assert.equal(res.body.data.autoBooked, false);
    assert.equal(res.body.data.privateHistoryUsed, false);
  });

  it("rejects fare insight without a route", async () => {
    const res = await httpRequest("POST", "/api/v1/recommendations/fare-insight", { body: {} });
    assert.equal(res.status, 400);
    assert.equal(JSON.stringify(res.body).toLowerCase().includes("prisma"), false);
  });

  it("uses owner snapshots only for a grounded prediction", async () => {
    const user = await createUser("fares");
    const other = await createUser("faresother");
    for (let i = 0; i < 4; i += 1) {
      await prisma.supplierOfferSnapshot.create({
        data: {
          userId: user.id,
          product: "FLIGHT",
          supplierCode: "GALILEO",
          supplierOfferId: `SIM-PRED-${suffix}-${i}`,
          currency: "PKR",
          netMinor: 40000 + i * 100,
          supplierBookingRefs: { itinerary: { origin: "LHE", destination: "DXB" } },
          ttlMs: 60_000,
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
        },
      });
    }
    await prisma.supplierOfferSnapshot.create({
      data: {
        userId: other.id,
        product: "FLIGHT",
        supplierCode: "GALILEO",
        supplierOfferId: `SIM-OTHER-${suffix}`,
        currency: "PKR",
        netMinor: 120000,
        supplierBookingRefs: { itinerary: { origin: "LHE", destination: "DXB" } },
        ttlMs: 60_000,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    const mine = await httpRequest("POST", "/api/v1/recommendations/fare-insight", {
      headers: authHeader(user),
      body: {
        origin: "LHE",
        destination: "DXB",
        currentAmountMinor: 70000,
        currency: "PKR",
        departureDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      },
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.data.privateHistoryUsed, true);
    assert.equal(mine.body.data.prediction.available, true);
    assert.ok(["BOOK_NOW", "CONSIDER_WAIT"].includes(mine.body.data.prediction.suggestedAction));
    assert.equal(mine.body.data.autoBooked, false);

    const guest = await httpRequest("POST", "/api/v1/recommendations/fare-insight", {
      body: {
        origin: "LHE",
        destination: "DXB",
        currentAmountMinor: 70000,
        currency: "PKR",
      },
    });
    assert.equal(guest.body.data.privateHistoryUsed, false);
    assert.equal(guest.body.data.prediction.available, false);

    const leaked = await httpRequest("POST", "/api/v1/recommendations/fare-insight", {
      headers: authHeader(other),
      body: {
        origin: "ISB",
        destination: "LHR",
        currentAmountMinor: 90000,
        currency: "PKR",
      },
    });
    assert.equal(leaked.body.data.prediction.available, false);
  });
});

describe("proactive notifications", () => {
  it("does not notify when proactive offers are disabled", async () => {
    const user = await createUser("quiet");
    await prisma.booking.create({
      data: {
        userId: user.id,
        status: "COMPLETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 20000,
        netMinor: 18000,
        marginMinor: 2000,
        metadata: { origin: "LHE", destination: "DXB" },
      },
    });
    await predictive.updatePredictivePreferences(user.id, {
      proactiveEnabled: false,
      notifyApp: false,
    });
    const before = await prisma.notificationOutbox.count({ where: { userId: user.id } });
    await predictive.listPredictiveRecommendations(user.id, { notify: true });
    const after = await prisma.notificationOutbox.count({ where: { userId: user.id } });
    assert.equal(after, before);
  });

  it("notifies on a matching signal when enabled", async () => {
    const user = await createUser("loud");
    await prisma.booking.create({
      data: {
        userId: user.id,
        status: "COMPLETED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 20000,
        netMinor: 18000,
        marginMinor: 2000,
        metadata: { origin: "LHE", destination: "DXB" },
      },
    });
    const result = await predictive.listPredictiveRecommendations(user.id, { notify: true });
    assert.ok(result.items.length > 0);
    const notes = await prisma.notificationOutbox.findMany({ where: { userId: user.id } });
    assert.ok(notes.some((n) => String(n.dedupeKey).includes("predictive.offer")));
  });
});

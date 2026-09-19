/**
 * Phase 3 Autonomous Travel Concierge — rules, isolation, safe execution.
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
const concierge = await import("./concierge.service.js");

const suffix = Date.now();
const userIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.concierge.${label}.${suffix}@example.com`,
      name: `Concierge ${label}`,
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

async function createTicketedBooking(userId, metadata = {}) {
  return prisma.booking.create({
    data: {
      userId,
      status: "TICKETED",
      product: "FLIGHT",
      currency: "PKR",
      amountMinor: 50000,
      netMinor: 45000,
      marginMinor: 5000,
      metadata: {
        flightNumber: "PK309",
        origin: "LHE",
        destination: "DXB",
        ...metadata,
      },
    },
  });
}

const delayEvent = (minutes, fingerprint) => ({
  id: `evt-${fingerprint}`,
  type: "DELAY",
  fingerprint,
  payload: { minutesDelayed: minutes },
});

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
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
});

after(async () => {
  for (const id of userIds) {
    await prisma.conciergeExecution.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.conciergeRule.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.bookingTransition.deleteMany({ where: { booking: { userId: id } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.supplierOfferSnapshot.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("concierge rules HTTP", () => {
  it("creates, updates, and disables a traveller-owned rule", async () => {
    const user = await createUser("crud");
    const created = await httpRequest("POST", "/api/v1/concierge/rules", {
      headers: authHeader(user),
      body: {
        name: "Delay > 2h",
        trigger: "DELAY",
        thresholdMinutes: 120,
        action: "PREPARE_REBOOK",
        maxAdditionalMinor: 2_000_000,
        currency: "PKR",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.enabled, true);
    const id = created.body.data.id;

    const updated = await httpRequest("PATCH", `/api/v1/concierge/rules/${id}`, {
      headers: authHeader(user),
      body: { maxAdditionalMinor: 1_500_000 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.maxAdditionalMinor, 1_500_000);

    const disabled = await httpRequest("POST", `/api/v1/concierge/rules/${id}/disable`, {
      headers: authHeader(user),
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.enabled, false);
  });

  it("isolates rules by owner", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const created = await httpRequest("POST", "/api/v1/concierge/rules", {
      headers: authHeader(owner),
      body: {
        name: "Owner only",
        trigger: "CANCELLED",
        action: "NOTIFY",
        maxAdditionalMinor: 0,
      },
    });
    const peek = await httpRequest("GET", `/api/v1/concierge/rules/${created.body.data.id}`, {
      headers: authHeader(other),
    });
    assert.equal(peek.status, 404);
    const listed = await httpRequest("GET", "/api/v1/concierge/rules", {
      headers: authHeader(other),
    });
    assert.equal(listed.body.data.items.some((r) => r.id === created.body.data.id), false);
  });
});

describe("concierge evaluation", () => {
  it("skips when delay is below threshold and executes notify when met", async () => {
    const user = await createUser("threshold");
    const booking = await createTicketedBooking(user.id);
    const rule = await concierge.createRule(user.id, {
      name: "2h delay",
      trigger: "DELAY",
      thresholdMinutes: 120,
      action: "NOTIFY",
      maxAdditionalMinor: 0,
    });

    const skipped = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(30, "below"),
      isFact: true,
    });
    assert.equal(skipped.status, "SKIPPED");
    assert.equal(skipped.reason, "THRESHOLD_NOT_MET");

    const executed = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(150, "met"),
      isFact: true,
    });
    assert.equal(executed.status, "EXECUTED");
    assert.equal(executed.reason, "NOTIFIED");
    assert.equal(executed.quoteBookingId, null);
  });

  it("blocks unverified provider data and actions outside the authorised rule", async () => {
    const user = await createUser("gates");
    const booking = await createTicketedBooking(user.id);
    const notifyRule = await concierge.createRule(user.id, {
      name: "Notify only",
      trigger: "DELAY",
      thresholdMinutes: 60,
      action: "NOTIFY",
      maxAdditionalMinor: 2_000_000,
    });
    const unverified = await concierge.evaluateRuleForEvent({
      rule: notifyRule,
      booking,
      event: delayEvent(180, "unverified"),
      isFact: false,
    });
    assert.equal(unverified.status, "BLOCKED");
    assert.equal(unverified.reason, "PROVIDER_UNVERIFIED");
    assert.equal(unverified.quoteBookingId, null);

    const withOption = await concierge.evaluateRuleForEvent({
      rule: notifyRule,
      booking,
      event: delayEvent(180, "notify-not-rebook"),
      isFact: true,
      replacementOption: {
        supplierOfferSnapshotId: "snap-should-not-use",
        amountMinor: 51000,
        currency: "PKR",
      },
    });
    assert.equal(withOption.status, "EXECUTED");
    assert.equal(withOption.reason, "NOTIFIED");
    assert.equal(withOption.quoteBookingId, null);
  });

  it("enforces budget, corporate approval, and does not duplicate work", async () => {
    const user = await createUser("budget");
    const booking = await createTicketedBooking(user.id);
    const snapshot = await prisma.supplierOfferSnapshot.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        supplierCode: "GALILEO",
        supplierOfferId: `SIM-CONC-${suffix}`,
        currency: "PKR",
        netMinor: 90000,
        supplierBookingRefs: { booking: { transactionId: "t-c" } },
        ttlMs: 60_000,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const rule = await concierge.createRule(user.id, {
      name: "Auto rebook within 20k",
      trigger: "DELAY",
      thresholdMinutes: 120,
      action: "AUTONOMOUS_REBOOK",
      maxAdditionalMinor: 2_000_000,
    });

    const overBudget = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(180, "over"),
      isFact: true,
      replacementOption: {
        supplierOfferSnapshotId: snapshot.id,
        amountMinor: booking.amountMinor + 2_000_001,
        currency: "PKR",
      },
    });
    assert.equal(overBudget.status, "BLOCKED");
    assert.equal(overBudget.reason, "BUDGET_EXCEEDED");

    const corpBooking = await createTicketedBooking(user.id, { companyId: "missing-company" });
    const corp = await concierge.evaluateRuleForEvent({
      rule,
      booking: corpBooking,
      event: delayEvent(180, "corp"),
      isFact: true,
      replacementOption: {
        supplierOfferSnapshotId: snapshot.id,
        amountMinor: corpBooking.amountMinor + 1000,
        currency: "PKR",
      },
    });
    assert.equal(corp.status, "BLOCKED");
    assert.ok(["CORPORATE_GATE", "CORPORATE_APPROVAL_REQUIRED"].includes(corp.reason));

    const first = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(180, "dup"),
      isFact: true,
      replacementOption: {
        supplierOfferSnapshotId: snapshot.id,
        amountMinor: booking.amountMinor + 1000,
        currency: "PKR",
      },
    });
    const second = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(180, "dup"),
      isFact: true,
      replacementOption: {
        supplierOfferSnapshotId: snapshot.id,
        amountMinor: booking.amountMinor + 1000,
        currency: "PKR",
      },
    });
    assert.equal(first.id, second.id);
    assert.ok(["EXECUTED", "ESCALATED"].includes(first.status));
    if (first.quoteBookingId) {
      const quotes = await prisma.booking.count({
        where: { userId: user.id, status: "QUOTED" },
      });
      assert.equal(quotes, 1);
    }
  });

  it("escalates when a quote cannot be created and writes notify + audit", async () => {
    const user = await createUser("fail");
    const booking = await createTicketedBooking(user.id);
    const rule = await concierge.createRule(user.id, {
      name: "Auto rebook",
      trigger: "DELAY",
      thresholdMinutes: 120,
      action: "AUTONOMOUS_REBOOK",
      maxAdditionalMinor: 2_000_000,
    });
    const failed = await concierge.evaluateRuleForEvent({
      rule,
      booking,
      event: delayEvent(200, "nosafe"),
      isFact: true,
      replacementOption: null,
    });
    assert.equal(failed.status, "ESCALATED");
    assert.equal(failed.reason, "NO_SAFE_OPTION");

    const notes = await prisma.notificationOutbox.findMany({ where: { userId: user.id } });
    assert.ok(notes.some((n) => n.dedupeKey.includes("concierge")));
    const audits = await prisma.auditLog.findMany({
      where: { userId: user.id, action: { startsWith: "concierge." } },
    });
    assert.ok(audits.length > 0);
  });
});

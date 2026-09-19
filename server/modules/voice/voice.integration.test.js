/**
 * Phase 3 Voice AI — HTTP + OTP confirmation. Never tickets from voice.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.FLIGHTONE_API_LISTEN = "false";
process.env.VOICE_TELEPHONY_PROVIDER = "unconfigured";
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
const voiceService = await import("./voice.service.js");

const suffix = Date.now();
const userIds = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.voice.${label}.${suffix}@example.com`,
      name: `Voice ${label}`,
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
  voiceService.resetVoiceOtpGeneratorForTests();
  for (const id of userIds) {
    await prisma.voiceOtpChallenge.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.voiceBookingIntent.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.voiceSession.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.voiceCallerBinding.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.message.deleteMany({
      where: { conversation: { userId: id } },
    }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.bookingTransition.deleteMany({ where: { booking: { userId: id } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.supplierOfferSnapshot.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("voice AI HTTP", () => {
  it("rejects guest voice sessions", async () => {
    const res = await httpRequest("POST", "/api/v1/voice/sessions", { body: {} });
    assert.equal(res.status, 401);
  });

  it("creates an authenticated web session and reports unconfigured phone", async () => {
    const user = await createUser("web");
    const res = await httpRequest("POST", "/api/v1/voice/sessions", {
      headers: authHeader(user),
      body: {},
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.channel, "WEB");
    assert.equal(res.body.data.state, "IDLE");
    const cap = await httpRequest("GET", "/api/v1/voice/capability");
    assert.equal(cap.status, 200);
    assert.equal(cap.body.data.phone.configured, false);
    const blob = JSON.stringify(cap.body);
    assert.equal(/api[_-]?key|secret|bearer /i.test(blob), false);
  });

  it("requires confirmation for voice booking and does not create a ticket", async () => {
    const user = await createUser("book");
    const session = await httpRequest("POST", "/api/v1/voice/sessions", {
      headers: authHeader(user),
      body: {},
    });
    const turn = await httpRequest("POST", `/api/v1/voice/sessions/${session.body.data.id}/turn`, {
      headers: authHeader(user),
      body: { transcript: "Please book this flight", persistConversation: true },
    });
    assert.equal(turn.status, 200);
    assert.equal(turn.body.data.intent.kind, "BOOKING");
    assert.equal(turn.body.data.intent.requiresConfirmation, true);
    assert.equal(turn.body.data.booking.otpRequired, true);
    assert.equal(turn.body.data.booking.ticketed, false);
    assert.equal(turn.body.data.booking.booked, false);
    const bookings = await prisma.booking.count({ where: { userId: user.id } });
    assert.equal(bookings, 0);
  });

  it("issues OTP, rejects invalid/expired codes, then quotes after a valid code", async () => {
    const user = await createUser("otp");
    const snapshot = await prisma.supplierOfferSnapshot.create({
      data: {
        userId: user.id,
        product: "FLIGHT",
        supplierCode: "GALILEO",
        supplierOfferId: `SIM-VOICE-${suffix}`,
        currency: "USD",
        netMinor: 12000,
        supplierBookingRefs: { booking: { transactionId: "t-voice" } },
        ttlMs: 60_000,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const session = await httpRequest("POST", "/api/v1/voice/sessions", {
      headers: authHeader(user),
      body: {},
    });
    const sessionId = session.body.data.id;
    const prepared = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/booking/prepare`, {
      headers: authHeader(user),
      body: { supplierOfferSnapshotId: snapshot.id },
    });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.data.intent.otpRequired, true);
    const intentId = prepared.body.data.intent.id;

    voiceService.setVoiceOtpGeneratorForTests(() => "847291");
    const requested = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/otp/request`, {
      headers: authHeader(user),
      body: { intentId },
    });
    assert.equal(requested.status, 200);
    assert.equal(requested.body.data.otpRequired, true);
    assert.equal(JSON.stringify(requested.body).includes("847291"), false);

    const bad = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/otp/confirm`, {
      headers: authHeader(user),
      body: { intentId, code: "000000" },
    });
    assert.equal(bad.status, 401);
    assert.match(String(bad.body.message), /invalid or has expired/i);

    await prisma.voiceOtpChallenge.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/otp/confirm`, {
      headers: authHeader(user),
      body: { intentId, code: "847291" },
    });
    assert.equal(expired.status, 410);

    voiceService.setVoiceOtpGeneratorForTests(() => "112233");
    const requested2 = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/otp/request`, {
      headers: authHeader(user),
      body: { intentId },
    });
    assert.equal(requested2.status, 200);
    const ok = await httpRequest("POST", `/api/v1/voice/sessions/${sessionId}/otp/confirm`, {
      headers: authHeader(user),
      body: { intentId, code: "112233" },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.confirmed, true);
    assert.equal(ok.body.data.ticketed, false);
    assert.equal(ok.body.data.paid, false);
    assert.ok(ok.body.data.bookingId);
    const booking = await prisma.booking.findUnique({ where: { id: ok.body.data.bookingId } });
    assert.equal(booking.status, "QUOTED");
  });

  it("returns an honest unconfigured phone webhook without raw provider errors", async () => {
    const res = await httpRequest("POST", "/api/v1/voice/telephony/inbound", {
      body: { From: "+15555550100", userId: "attacker" },
    });
    assert.equal(res.status, 503);
    assert.match(String(res.body.message), /not configured/i);
    assert.equal(JSON.stringify(res.body).toLowerCase().includes("stack"), false);
    assert.equal(JSON.stringify(res.body).includes("attacker"), false);
  });
});

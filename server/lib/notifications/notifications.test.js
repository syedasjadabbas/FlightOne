/**
 * Notification delivery + drain tests.
 * Run: node --test lib/notifications/notifications.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

import {
  deliverAppNotification,
  deliverEmailNotification,
  deliverWhatsAppNotification,
  deliverSmsNotification,
  deliverNotification,
} from "./deliver.js";

describe("notification channel adapters", () => {
  it("APP delivery succeeds without external credentials", async () => {
    const r = await deliverAppNotification({
      id: "n1",
      userId: "u1",
      title: "t",
      body: "b",
    });
    assert.equal(r.ok, true);
    assert.equal(r.provider, "app-inbox");
  });

  it("EMAIL fails clearly when webhook unset (no fake SENT)", async () => {
    const r = await deliverEmailNotification(
      { id: "n2", userId: "u1", title: "t", body: "b" },
      { env: {} },
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, "email_not_configured");
    assert.equal(r.retryable, false);
  });

  it("WHATSAPP fails clearly when webhook unset", async () => {
    const r = await deliverWhatsAppNotification(
      { id: "n3", userId: "u1", title: "t", body: "b" },
      { env: {} },
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, "whatsapp_webhook_not_configured");
  });

  it("EMAIL webhook success marks ok", async () => {
    const r = await deliverEmailNotification(
      {
        id: "n4",
        userId: "u1",
        title: "Expiry",
        body: "soon",
        dedupeKey: "k",
      },
      {
        env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
        resolveRecipient: async () => ({ email: "u1@example.com", name: "U" }),
      },
    );
    assert.equal(r.ok, true);
  });

  it("EMAIL Resend success marks ok", async () => {
    let calledUrl = null;
    let calledBody = null;
    const r = await deliverEmailNotification(
      {
        id: "n4r",
        userId: "u1",
        title: "Verify",
        body: "code 123456",
        dedupeKey: "email-verification:u1:1",
        payload: { kind: "email_verification_otp", otp: "123456" },
      },
      {
        env: {
          RESEND_API_KEY: "re_test",
          RESEND_FROM_EMAIL: "FlightOne <noreply@example.com>",
        },
        resolveRecipient: async () => ({
          email: "traveller@example.com",
          name: "Traveller",
        }),
        fetchImpl: async (url, init) => {
          calledUrl = url;
          calledBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: "re_msg_1" }),
          };
        },
      },
    );
    assert.equal(r.ok, true);
    assert.equal(r.provider, "resend");
    assert.equal(r.messageId, "re_msg_1");
    assert.equal(calledUrl, "https://api.resend.com/emails");
    assert.deepEqual(calledBody.to, ["traveller@example.com"]);
    assert.equal(calledBody.from, "FlightOne <noreply@example.com>");
    assert.match(calledBody.html, /123456/);
  });

  it("EMAIL webhook 5xx is retryable", async () => {
    const r = await deliverNotification(
      { id: "n5", userId: "u1", channel: "EMAIL", title: "t", body: "b" },
      {
        env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
        fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }),
        resolveRecipient: async () => ({ email: "u1@example.com", name: "U" }),
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.retryable, true);
  });

  it("SMS fails clearly when unconfigured (no fake SENT)", async () => {
    const r = await deliverSmsNotification(
      { id: "n6", userId: "u1", title: "t", body: "b", payload: { phone: "+923001234567" } },
      { env: {} },
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, "sms_not_configured");
    assert.equal(r.retryable, false);
  });

  it("SMS fails when recipient phone number missing or invalid", async () => {
    const r = await deliverSmsNotification(
      { id: "n7", userId: "u1", title: "t", body: "b", payload: {} },
      {
        env: {
          TWILIO_ACCOUNT_SID: "ACtest",
          TWILIO_AUTH_TOKEN: "testtok",
          TWILIO_FROM_NUMBER: "+1234567890",
        },
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, "sms_recipient_phone_missing_or_invalid");
  });

  it("SMS Twilio dispatch succeeds with valid credentials", async () => {
    let calledUrl = null;
    let authHeader = null;
    const r = await deliverSmsNotification(
      {
        id: "n8",
        userId: "u1",
        title: "OTP",
        body: "Your code is 123456",
        payload: { phone: "03001234567" },
      },
      {
        env: {
          TWILIO_ACCOUNT_SID: "ACtest123",
          TWILIO_AUTH_TOKEN: "secret456",
          TWILIO_FROM_NUMBER: "+15551234567",
        },
        fetchImpl: async (url, opts) => {
          calledUrl = url;
          authHeader = opts.headers.Authorization;
          return {
            ok: true,
            status: 201,
            json: async () => ({ sid: "SM_test_sid_123", status: "queued" }),
          };
        },
      },
    );

    assert.equal(r.ok, true);
    assert.equal(r.provider, "sms-twilio");
    assert.equal(r.messageId, "SM_test_sid_123");
    assert.match(calledUrl, /api\.twilio\.com.*ACtest123/);
    assert.match(authHeader, /^Basic /);
  });

  it("SMS Twilio 5xx error is marked retryable", async () => {
    const r = await deliverSmsNotification(
      {
        id: "n9",
        userId: "u1",
        title: "Alert",
        body: "Flight delayed",
        payload: { phone: "+923001234567" },
      },
      {
        env: {
          TWILIO_ACCOUNT_SID: "ACtest",
          TWILIO_AUTH_TOKEN: "tok",
          TWILIO_FROM_NUMBER: "+123",
        },
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          json: async () => ({ code: 20500, message: "Twilio internal error" }),
        }),
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.retryable, true);
  });

  it("SMS simulated double dispatches successfully when allowed", async () => {
    const r = await deliverSmsNotification(
      {
        id: "n10",
        userId: "u1",
        title: "Test",
        body: "Testing simulation",
        payload: { phone: "+923001234567" },
      },
      {
        env: { ALLOW_SIMULATED_NOTIFICATIONS: "true" },
      },
    );
    assert.equal(r.ok, true);
    assert.equal(r.provider, "sms-simulated");
    assert.match(r.messageId, /^sim_sms_/);
  });

  it("WHATSAPP Meta Cloud API dispatch succeeds with valid credentials", async () => {
    let sentBody = null;
    let authHeader = null;
    const r = await deliverWhatsAppNotification(
      {
        id: "n11",
        userId: "u1",
        title: "Booking Confirmed",
        body: "Your booking FO-123 is confirmed.",
        payload: { phone: "+923001234567" },
      },
      {
        env: {
          WHATSAPP_API_TOKEN: "EAAtesttoken",
          WHATSAPP_PHONE_NUMBER_ID: "10987654321",
        },
        fetchImpl: async (url, opts) => {
          authHeader = opts.headers.Authorization;
          sentBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              messaging_product: "whatsapp",
              contacts: [{ input: "923001234567", wa_id: "923001234567" }],
              messages: [{ id: "wamid.HBgLMTIzNDU=" }],
            }),
          };
        },
      },
    );

    assert.equal(r.ok, true);
    assert.equal(r.provider, "whatsapp-cloud");
    assert.equal(r.messageId, "wamid.HBgLMTIzNDU=");
    assert.equal(authHeader, "Bearer EAAtesttoken");
    assert.equal(sentBody.to, "923001234567");
    assert.equal(sentBody.type, "text");
    assert.equal(sentBody.text.body, "Your booking FO-123 is confirmed.");
  });

  it("WHATSAPP Cloud API 5xx error is marked retryable", async () => {
    const r = await deliverWhatsAppNotification(
      {
        id: "n12",
        userId: "u1",
        title: "t",
        body: "b",
        payload: { phone: "+923001234567" },
      },
      {
        env: {
          WHATSAPP_API_TOKEN: "tok",
          WHATSAPP_PHONE_NUMBER_ID: "123",
        },
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: "Internal server error", code: 131000 } }),
        }),
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.retryable, true);
  });

  it("WHATSAPP simulated double dispatches successfully when allowed", async () => {
    const r = await deliverWhatsAppNotification(
      {
        id: "n13",
        userId: "u1",
        title: "t",
        body: "b",
        payload: { phone: "+923001234567" },
      },
      {
        env: { ALLOW_SIMULATED_NOTIFICATIONS: "true" },
      },
    );
    assert.equal(r.ok, true);
    assert.equal(r.provider, "whatsapp-simulated");
    assert.match(r.messageId, /^sim_wa_/);
  });
});

describe("notification outbox drain (integration)", () => {
  const users = [];
  let prisma;
  let drainNotificationOutbox;

  before(async () => {
    prisma = (await import("../../config/prisma.js")).default;
    drainNotificationOutbox = (await import("./drain.js")).drainNotificationOutbox;
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    for (const id of users) {
      await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("drains APP to SENT; EMAIL unconfigured to FAILED; preserves dedupe", async () => {
    const user = await prisma.user.create({
      data: {
        email: `fo.notify.${Date.now()}@example.com`,
        name: "Notify",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    users.push(user.id);

    const dedupeKey = `profile-doc-expiry:testdoc:lead:7`;
    await prisma.notificationOutbox.createMany({
      data: [
        {
          userId: user.id,
          channel: "APP",
          dedupeKey,
          title: "Passport expiry",
          body: "7 days",
          payload: { kind: "document_expiry" },
        },
        {
          userId: user.id,
          channel: "EMAIL",
          dedupeKey,
          title: "Passport expiry",
          body: "7 days",
          payload: { kind: "document_expiry" },
        },
        {
          userId: user.id,
          channel: "WHATSAPP",
          dedupeKey,
          title: "Passport expiry",
          body: "7 days",
          payload: { kind: "document_expiry" },
        },
      ],
      skipDuplicates: true,
    });

    // Second enqueue must not duplicate (unique constraint path).
    const dup = await prisma.notificationOutbox.createMany({
      data: [
        {
          userId: user.id,
          channel: "APP",
          dedupeKey,
          title: "Passport expiry",
          body: "dup",
        },
      ],
      skipDuplicates: true,
    });
    assert.equal(dup.count, 0);

    // Isolate from leftover PENDING rows left by other suites (e.g. rewards).
    await prisma.notificationOutbox.deleteMany({
      where: {
        status: "PENDING",
        userId: { not: user.id },
      },
    });

    const result = await drainNotificationOutbox({
      env: {}, // no email/whatsapp webhooks
      limit: 20,
    });

    assert.equal(result.drained, 1); // APP only
    assert.equal(result.failed, 2); // EMAIL + WHATSAPP not configured

    const rows = await prisma.notificationOutbox.findMany({
      where: { userId: user.id },
      orderBy: { channel: "asc" },
    });
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r.status]));
    assert.equal(byChannel.APP, "SENT");
    assert.equal(byChannel.EMAIL, "FAILED");
    assert.equal(byChannel.WHATSAPP, "FAILED");
  });

  it("retryable EMAIL failure leaves row PENDING", async () => {
    const user = await prisma.user.create({
      data: {
        email: `fo.notify.retry.${Date.now()}@example.com`,
        name: "Retry",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    users.push(user.id);

    await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        channel: "EMAIL",
        dedupeKey: `retry-test-${Date.now()}`,
        title: "t",
        body: "b",
      },
    });

    await prisma.notificationOutbox.deleteMany({
      where: {
        status: "PENDING",
        userId: { not: user.id },
      },
    });

    const result = await drainNotificationOutbox({
      env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
      fetchImpl: async () => ({ ok: false, status: 503 }),
      limit: 10,
    });
    assert.equal(result.deferred, 1);
    assert.equal(result.drained, 0);

    const row = await prisma.notificationOutbox.findFirst({
      where: { userId: user.id, channel: "EMAIL" },
    });
    assert.equal(row.status, "PENDING");
  });

  it("exhausting maxAttempts marks retryable failure as FAILED", async () => {
    const user = await prisma.user.create({
      data: {
        email: `fo.notify.maxretry.${Date.now()}@example.com`,
        name: "MaxRetry",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    users.push(user.id);

    const dedupeKey = `max-retry-${Date.now()}`;
    await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        channel: "EMAIL",
        dedupeKey,
        title: "t",
        body: "b",
      },
    });

    await prisma.notificationOutbox.deleteMany({
      where: {
        status: "PENDING",
        userId: { not: user.id },
      },
    });

    // Pass 1: attempt 1 with maxAttempts: 2 -> remains PENDING
    const pass1 = await drainNotificationOutbox({
      env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
      fetchImpl: async () => ({ ok: false, status: 503 }),
      limit: 10,
      maxAttempts: 2,
    });
    assert.equal(pass1.deferred, 1);
    assert.equal(pass1.failed, 0);

    // Pass 2: attempt 2 reaches maxAttempts -> marks FAILED
    const pass2 = await drainNotificationOutbox({
      env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
      fetchImpl: async () => ({ ok: false, status: 503 }),
      limit: 10,
      maxAttempts: 2,
    });
    assert.equal(pass2.deferred, 0);
    assert.equal(pass2.failed, 1);

    const row = await prisma.notificationOutbox.findFirst({
      where: { userId: user.id, dedupeKey },
    });
    assert.equal(row.status, "FAILED");
    assert.match(row.payload.deliveryError.reason, /^max_retries_exceeded/);
  });
});

describe("provider callback handling", () => {
  let prisma;
  const users = [];

  before(async () => {
    prisma = (await import("../../config/prisma.js")).default;
  });

  after(async () => {
    for (const id of users) {
      await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it("SMS callback updates status to DELIVERED idempotently", async () => {
    const { handleSmsCallback } = await import("../../modules/notifications/notifications.controller.js");

    const user = await prisma.user.create({
      data: {
        email: `fo.cb.sms.${Date.now()}@example.com`,
        name: "SmsCb",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    users.push(user.id);

    const messageSid = `SM_cb_test_${Date.now()}`;
    const row = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        channel: "SMS",
        dedupeKey: `sms-cb-${Date.now()}`,
        title: "Test",
        body: "Testing callback",
        status: "SENT",
        payload: {
          delivery: { provider: "sms-twilio", messageId: messageSid, status: "SENT" },
        },
      },
    });

    // Mock Express req & res
    let responseStatus = null;
    let responseJson = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      },
    };

    // First delivered callback
    await handleSmsCallback(
      { body: { MessageSid: messageSid, MessageStatus: "delivered" } },
      res,
    );

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.ok, true);
    assert.equal(responseJson.updated, true);
    assert.equal(responseJson.status, "DELIVERED");

    let updated = await prisma.notificationOutbox.findUnique({ where: { id: row.id } });
    assert.equal(updated.status, "DELIVERED");
    assert.ok(updated.payload.delivery.deliveredAt);

    // Duplicate callback -> idempotent no-op
    await handleSmsCallback(
      { body: { MessageSid: messageSid, MessageStatus: "delivered" } },
      res,
    );
    assert.equal(responseJson.ok, true);
    assert.equal(responseJson.updated, false);
  });

  it("WhatsApp Meta Cloud API callback updates status to READ", async () => {
    const { handleWhatsAppCallback } = await import("../../modules/notifications/notifications.controller.js");

    const user = await prisma.user.create({
      data: {
        email: `fo.cb.wa.${Date.now()}@example.com`,
        name: "WaCb",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    users.push(user.id);

    const waMessageId = `wamid.HBgL_${Date.now()}`;
    const row = await prisma.notificationOutbox.create({
      data: {
        userId: user.id,
        channel: "WHATSAPP",
        dedupeKey: `wa-cb-${Date.now()}`,
        title: "Test",
        body: "Testing WA callback",
        status: "SENT",
        payload: {
          delivery: { provider: "whatsapp-cloud", messageId: waMessageId, status: "SENT" },
        },
      },
    });

    const res = {
      status: () => res,
      json: (d) => d,
    };

    // 1. Delivered
    await handleWhatsAppCallback(
      {
        body: {
          entry: [
            {
              changes: [
                {
                  value: {
                    statuses: [{ id: waMessageId, status: "delivered", timestamp: "1726660000" }],
                  },
                },
              ],
            },
          ],
        },
      },
      res,
    );

    let updated = await prisma.notificationOutbox.findUnique({ where: { id: row.id } });
    assert.equal(updated.status, "DELIVERED");

    // 2. Read
    await handleWhatsAppCallback(
      {
        body: {
          entry: [
            {
              changes: [
                {
                  value: {
                    statuses: [{ id: waMessageId, status: "read", timestamp: "1726660010" }],
                  },
                },
              ],
            },
          ],
        },
      },
      res,
    );

    updated = await prisma.notificationOutbox.findUnique({ where: { id: row.id } });
    assert.equal(updated.status, "READ");
    assert.ok(updated.payload.delivery.readAt);
  });
});

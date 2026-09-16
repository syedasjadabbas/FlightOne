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
    assert.equal(r.reason, "email_webhook_not_configured");
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
        fetchImpl: async () => ({ ok: true, status: 200 }),
      },
    );
    assert.equal(r.ok, true);
  });

  it("EMAIL webhook 5xx is retryable", async () => {
    const r = await deliverNotification(
      { id: "n5", userId: "u1", channel: "EMAIL", title: "t", body: "b" },
      {
        env: { NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.test/email" },
        fetchImpl: async () => ({ ok: false, status: 502 }),
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.retryable, true);
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
});

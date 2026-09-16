/**
 * Unit tests for shared NotificationOutbox enqueue helper.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const { default: prisma } = await import("../../config/prisma.js");
const { enqueueNotificationOutbox } = await import("./enqueue.js");

const suffix = Date.now();
const userIds = [];

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of userIds) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("enqueueNotificationOutbox", () => {
  it("enqueues rows and dedupes on second insert", async () => {
    const user = await prisma.user.create({
      data: {
        email: `fo.enq.${suffix}@example.com`,
        name: "Enqueue",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
      },
    });
    userIds.push(user.id);

    const rows = [
      {
        userId: user.id,
        channel: "APP",
        dedupeKey: `test:enqueue:${suffix}:APP`,
        title: "t",
        body: "b",
        payload: { module: "test" },
      },
    ];
    const first = await enqueueNotificationOutbox(rows);
    assert.equal(first.enqueued, 1);
    const second = await enqueueNotificationOutbox(rows);
    assert.equal(second.enqueued, 0);
  });

  it("returns zero for empty input", async () => {
    const r = await enqueueNotificationOutbox([]);
    assert.equal(r.enqueued, 0);
  });
});

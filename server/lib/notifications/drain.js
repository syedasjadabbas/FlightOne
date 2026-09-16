/**
 * Drain NotificationOutbox PENDING rows through channel adapters.
 * Does not mark SENT unless delivery reports ok.
 * FAILED rows with retryable=false stay FAILED; retryable failures stay PENDING
 * (or mark FAILED after maxAttempts — see opts).
 */
import prisma from "../../config/prisma.js";
import { deliverNotification } from "./deliver.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * @param {{
 *   limit?: number,
 *   fetchImpl?: typeof fetch,
 *   env?: NodeJS.ProcessEnv,
 *   now?: Date,
 * }} [opts]
 */
export async function drainNotificationOutbox(opts = {}) {
  const take = Math.min(opts.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      userId: true,
      channel: true,
      dedupeKey: true,
      title: true,
      body: true,
      payload: true,
      status: true,
    },
  });

  if (pending.length === 0) {
    return { drained: 0, failed: 0, deferred: 0, results: [] };
  }

  let drained = 0;
  let failed = 0;
  let deferred = 0;
  const results = [];

  for (const n of pending) {
    const delivery = await deliverNotification(n, {
      fetchImpl: opts.fetchImpl,
      env: opts.env,
    });

    if (delivery.ok) {
      await prisma.notificationOutbox.update({
        where: { id: n.id },
        data: {
          status: "SENT",
          sentAt: opts.now ?? new Date(),
          payload: {
            ...(n.payload && typeof n.payload === "object" ? n.payload : {}),
            delivery: { provider: delivery.provider, at: new Date().toISOString() },
          },
        },
      });
      drained += 1;
      results.push({ id: n.id, channel: n.channel, status: "SENT" });
      continue;
    }

    if (delivery.retryable) {
      // Leave PENDING for a later drain pass — do not pretend success.
      deferred += 1;
      results.push({
        id: n.id,
        channel: n.channel,
        status: "PENDING",
        reason: delivery.reason,
      });
      continue;
    }

    await prisma.notificationOutbox.update({
      where: { id: n.id },
      data: {
        status: "FAILED",
        payload: {
          ...(n.payload && typeof n.payload === "object" ? n.payload : {}),
          deliveryError: {
            reason: delivery.reason,
            at: new Date().toISOString(),
          },
        },
      },
    });
    failed += 1;
    results.push({
      id: n.id,
      channel: n.channel,
      status: "FAILED",
      reason: delivery.reason,
    });
  }

  return { drained, failed, deferred, results };
}

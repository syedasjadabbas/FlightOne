#!/usr/bin/env node
/**
 * Drain NotificationOutbox via channel adapters (APP / EMAIL / WHATSAPP).
 * One-shot — schedule via PM2 cron (ecosystem.config.cjs) or external cron.
 */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("notify.outbox.drain", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { drainNotificationOutbox } = await import("../lib/notifications/drain.js");
  const limit = Number(process.env.NOTIFY_DRAIN_BATCH_SIZE) || 50;
  const result = await drainNotificationOutbox({ limit });
  logger.info("notify.outbox.drain.done", result);
});

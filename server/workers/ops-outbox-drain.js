#!/usr/bin/env node
/**
 * Drain OpsOutboxEvent PENDING rows through CRM / mid / back / accounting adapters.
 * One-shot — schedule via PM2 cron (ecosystem.config.cjs) or external cron.
 * Fail-closed: never marks DELIVERED when destinations are UNCONFIGURED.
 */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("ops.outbox.drain", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { drainOutbox } = await import("../modules/operations/operations.service.js");
  const limit = Number(process.env.OPS_DRAIN_BATCH_SIZE) || 50;
  const result = await drainOutbox({ limit });
  logger.info("ops.outbox.drain.done", {
    claimed: result.claimed,
    delivered: result.delivered,
    failed: result.failed,
    deferred: result.deferred,
    unconfigured: result.unconfigured,
  });
});

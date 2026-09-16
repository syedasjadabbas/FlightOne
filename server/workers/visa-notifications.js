#!/usr/bin/env node
/** Module 08 — visa expiry + apply-by notification worker (one-shot). */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("visa.notifications", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { runVisaNotificationScheduler } = await import(
    "../modules/visa/visa.notifications.js"
  );
  const result = await runVisaNotificationScheduler();
  logger.info("visa.notifications.worker.done", result);
});

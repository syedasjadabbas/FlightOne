#!/usr/bin/env node
/** Module 10 — expire aged reward credit lots (one-shot). */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("rewards.expiry", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { runRewardExpiryScheduler } = await import("../modules/rewards/rewards.service.js");
  const result = await runRewardExpiryScheduler();
  logger.info("rewards.expiry.worker.done", result);
});

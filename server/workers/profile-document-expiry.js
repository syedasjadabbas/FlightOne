#!/usr/bin/env node
/**
 * Module 02 — document expiry notification worker (one-shot).
 */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("profile.document_expiry", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { runDocumentExpiryScheduler } = await import(
    "../modules/profile/documentExpiry.scheduler.js"
  );
  const result = await runDocumentExpiryScheduler();
  logger.info("profile.document_expiry.worker.done", result);
});

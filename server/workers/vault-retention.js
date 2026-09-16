#!/usr/bin/env node
/**
 * Module 07 — Vault retention purge worker (one-shot).
 * Env: VAULT_RETENTION_DAYS (default 365), VAULT_PURGE_LIMIT (default 100)
 */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

void runOneShotWorker("vault.retention", async ({ logger, shouldStop }) => {
  if (shouldStop()) return;
  const { runVaultRetentionPurge } = await import("../modules/vault/vault.retention.js");
  const limit = Number(process.env.VAULT_PURGE_LIMIT) || 100;
  const result = await runVaultRetentionPurge({ limit });
  logger.info("Vault retention purge complete", {
    scanned: result.scanned,
    purged: result.purged,
    skipped: result.skipped,
    retentionDays: result.retentionDays,
  });
});

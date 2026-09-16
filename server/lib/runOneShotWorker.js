/**
 * Shared one-shot worker runner (PM2 cron / manual).
 * Installs SIGTERM/SIGINT abort + Prisma disconnect; does not change scheduling.
 */
import dotenv from "dotenv";
import { createWorkerLifecycle } from "./gracefulShutdown.js";

dotenv.config();

/**
 * @param {string} name log prefix
 * @param {(ctx: { signal: AbortSignal, shouldStop: () => boolean, prisma: import('@prisma/client').PrismaClient, logger: any }) => Promise<unknown>} work
 */
export async function runOneShotWorker(name, work) {
  const { default: prisma } = await import("../config/prisma.js");
  const logger = (await import("./logger.js")).default;
  const lifecycle = createWorkerLifecycle({
    name,
    disconnect: () => prisma.$disconnect(),
    logger,
  });

  try {
    if (lifecycle.shouldStop()) {
      await lifecycle.complete();
      return;
    }
    await work({
      signal: lifecycle.signal,
      shouldStop: lifecycle.shouldStop,
      prisma,
      logger,
    });
    await lifecycle.complete();
  } catch (e) {
    await lifecycle.fail(e);
  }
}

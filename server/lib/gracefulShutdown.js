/**
 * Graceful process shutdown for the API and one-shot workers.
 *
 * API: stop accepting connections → drain in-flight → disconnect Prisma → exit.
 * Workers: abort signal → finish/skip remaining work → disconnect Prisma → exit.
 */
import appLogger from "./logger.js";

const DEFAULT_SHUTDOWN_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 25_000;

/** @type {{ shuttingDown: boolean }} */
export const processLifecycle = {
  shuttingDown: false,
};

/**
 * @param {{
 *   server?: import('node:http').Server,
 *   cleanup?: () => Promise<void> | void,
 *   timeoutMs?: number,
 *   exit?: (code: number) => void,
 *   logger?: { info: Function, error: Function, warn: Function },
 *   registerSignals?: boolean,
 * }} opts
 */
export function installGracefulShutdown(opts = {}) {
  const {
    server = null,
    cleanup,
    timeoutMs = DEFAULT_SHUTDOWN_MS,
    exit = (code) => process.exit(code),
    logger = appLogger,
    registerSignals = true,
  } = opts;

  let inProgress = false;

  async function shutdown(signal) {
    if (inProgress) {
      logger.warn("Shutdown already in progress — forcing exit", { signal });
      exit(1);
      return;
    }
    inProgress = true;
    processLifecycle.shuttingDown = true;
    logger.info("Graceful shutdown started", { signal, timeoutMs });

    const forceTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit", { timeoutMs });
      exit(1);
    }, timeoutMs);
    if (typeof forceTimer.unref === "function") forceTimer.unref();

    try {
      if (server && typeof server.close === "function") {
        await new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              logger.warn("HTTP server.close error", { err: err?.message });
            }
            resolve();
          });
          // Node 18.2+: drop idle keep-alive sockets so close can complete.
          if (typeof server.closeIdleConnections === "function") {
            server.closeIdleConnections();
          }
        });
      }

      if (typeof cleanup === "function") {
        await cleanup();
      }

      clearTimeout(forceTimer);
      logger.info("Graceful shutdown complete");
      exit(0);
    } catch (e) {
      clearTimeout(forceTimer);
      logger.error("Graceful shutdown failed", { err: e?.message });
      exit(1);
    }
  }

  if (registerSignals) {
    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });
  }

  return {
    shutdown,
    isShuttingDown: () => processLifecycle.shuttingDown,
  };
}

/**
 * One-shot worker lifecycle: AbortSignal + bounded force-exit on signals.
 * Does not redesign PM2 cron — workers remain one-shot scripts.
 *
 * @param {{
 *   name: string,
 *   timeoutMs?: number,
 *   disconnect?: () => Promise<void>,
 *   exit?: (code: number) => void,
 *   logger?: { info: Function, error: Function, warn: Function },
 * }} opts
 */
export function createWorkerLifecycle(opts) {
  const {
    name,
    timeoutMs = DEFAULT_SHUTDOWN_MS,
    disconnect,
    exit = (code) => process.exit(code),
    logger = appLogger,
  } = opts;

  const ac = new AbortController();
  let finishing = false;

  async function finish(code, reason) {
    if (finishing) return;
    finishing = true;
    processLifecycle.shuttingDown = true;
    try {
      if (typeof disconnect === "function") await disconnect();
    } catch (e) {
      logger.warn(`${name}.shutdown.disconnect_failed`, { err: e?.message });
    }
    logger.info(`${name}.shutdown.exit`, { code, reason });
    exit(code);
  }

  const onSig = (signal) => {
    if (ac.signal.aborted) {
      logger.warn(`${name}.shutdown.force`, { signal });
      exit(1);
      return;
    }
    logger.info(`${name}.shutdown.signal`, { signal });
    ac.abort(signal);
    const forceTimer = setTimeout(() => {
      void finish(1, "timeout");
    }, timeoutMs);
    if (typeof forceTimer.unref === "function") forceTimer.unref();
  };

  process.once("SIGTERM", () => onSig("SIGTERM"));
  process.once("SIGINT", () => onSig("SIGINT"));

  return {
    signal: ac.signal,
    shouldStop: () => ac.signal.aborted || processLifecycle.shuttingDown,
    complete: async () => finish(0, "complete"),
    fail: async (err) => {
      logger.error(`${name}.failed`, { err: err?.message || String(err) });
      await finish(1, "error");
    },
  };
}

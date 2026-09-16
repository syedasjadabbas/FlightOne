import logger from "../lib/logger.js";

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 500);

export function requestTiming(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const path = req.originalUrl || req.url;
    if (ms >= SLOW_MS) {
      logger.warn("slow request", {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(ms),
      });
    } else if (process.env.REQUEST_TIMING_DEBUG === "1") {
      logger.debug("request timing", {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(ms),
      });
    }
  });
  next();
}

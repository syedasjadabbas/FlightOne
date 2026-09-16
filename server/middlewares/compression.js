import { createRequire } from "node:module";
import logger from "../lib/logger.js";

const require = createRequire(import.meta.url);

/**
 * Returns the `compression` gzip middleware if the package is installed,
 * otherwise a passthrough no-op. Synchronous so it can be registered in the
 * correct position in the middleware chain (before routes).
 */
export function compressionMiddleware() {
  let compression;
  try {
    compression = require("compression");
  } catch {
    logger.warn(
      "compression package not installed — responses sent uncompressed. Run: npm install compression",
    );
    return (_req, _res, next) => next();
  }
  logger.info("HTTP compression enabled");
  return compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  });
}

/**
 * FlightOne API — modular Express entrypoint (same architecture as crm-server).
 * Public CORS, no office-network guard. Mount domain routers under /api/v1.
 */
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import prisma from "./config/prisma.js";
import appLogger from "./lib/logger.js";
import { AppError } from "./lib/customError.js";
import { successResponse, errorResponse } from "./lib/response.js";
import { sendExpressErrorResponse } from "./lib/utils.js";
import { requestContext } from "./lib/request-context.js";
import { apiLimiter } from "./middlewares/rateLimit.js";
import { requestTiming } from "./middlewares/requestTiming.js";
import { compressionMiddleware } from "./middlewares/compression.js";
import {
  assertProductionConfigSafe,
  isProductionEnv,
} from "./lib/productionConfig.js";
import {
  installGracefulShutdown,
  processLifecycle,
} from "./lib/gracefulShutdown.js";
import authRouter from "./modules/auth/index.js";
import bookingsRouter from "./modules/bookings/index.js";
import conversationsRouter from "./modules/conversations/index.js";
import corporateRouter from "./modules/corporate/index.js";
import dashboardRouter from "./modules/dashboard/index.js";
import escalationsRouter from "./modules/escalations/index.js";
import groupsRouter from "./modules/groups/index.js";
import journeyRouter from "./modules/journey/index.js";
import knowledgeRouter from "./modules/knowledge/index.js";
import meRouter from "./modules/me/index.js";
import miceRouter from "./modules/mice/index.js";
import notificationsRouter from "./modules/notifications/index.js";
import operationsRouter from "./modules/operations/index.js";
import paymentsRouter from "./modules/payments/index.js";
import pricingRouter from "./modules/pricing/index.js";
import profileRouter from "./modules/profile/index.js";
import recommendationsRouter from "./modules/recommendations/index.js";
import refundsRouter from "./modules/refunds/index.js";
import rewardsRouter from "./modules/rewards/index.js";
import suppliersRouter from "./modules/suppliers/index.js";
import visaRouter from "./modules/visa/index.js";
import vaultRouter from "./modules/vault/index.js";
import voiceRouter from "./modules/voice/index.js";
import conciergeRouter from "./modules/concierge/index.js";

dotenv.config();

try {
  assertProductionConfigSafe();
} catch (e) {
  // Fail closed before binding a port — never print secret values.
  console.error(e?.message || String(e));
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
app.set("env", process.env.NODE_ENV || "development");

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : isProductionEnv()
    ? []
    : true;

if (isProductionEnv() && (!Array.isArray(corsOrigin) || corsOrigin.length === 0)) {
  console.error(
    "Unsafe production configuration:\n- CORS_ORIGIN must list real frontend origin(s)",
  );
  process.exit(1);
}

app.use(helmet());
app.use(compressionMiddleware());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(requestContext);
app.use(requestTiming);
app.use(morgan(isProductionEnv() ? "combined" : "dev"));
// Vault uploads may send base64 (~4/3 of file size). Cap above VAULT_MAX_BYTES (10 MiB).
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// Liveness — process is up, no DB dependency (deploy platform's "is the
// container alive" probe; must never block on anything external).
app.get("/api/v1/health", (_req, res) => {
  return successResponse(res, "OK", {
    ok: true,
    service: "flight-one-api",
    shuttingDown: processLifecycle.shuttingDown,
  });
});

// Readiness — process is up AND its DB connection is actually usable (deploy
// platform's "route traffic to this instance" probe). A failed query means
// this instance isn't ready to serve, not that the process should restart.
// During graceful shutdown, fail readiness so the load balancer drains traffic.
app.get("/api/v1/health/ready", async (_req, res) => {
  if (processLifecycle.shuttingDown) {
    return errorResponse(res, "Shutting down", { ok: false, shuttingDown: true }, 503);
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return successResponse(res, "OK", { ok: true });
  } catch (e) {
    appLogger.error("Readiness check failed", { err: e?.message });
    return errorResponse(res, "Not ready", { ok: false }, 503);
  }
});

app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/conversations", conversationsRouter);
app.use("/api/v1/corporate", corporateRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/escalations", escalationsRouter);
app.use("/api/v1/groups", groupsRouter);
app.use("/api/v1/journey", journeyRouter);
app.use("/api/v1/knowledge", knowledgeRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/mice", miceRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/v1/operations", operationsRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/pricing", pricingRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/recommendations", recommendationsRouter);
app.use("/api/v1/refunds", refundsRouter);
app.use("/api/v1/rewards", rewardsRouter);
app.use("/api/v1/suppliers", suppliersRouter);
app.use("/api/v1/visa", visaRouter);
app.use("/api/v1/vault", vaultRouter);
app.use("/api/v1/voice", voiceRouter);
app.use("/api/v1/concierge", conciergeRouter);

app.use((req, res) => {
  appLogger.debug("Route not found", { method: req.method, path: req.path });
  return errorResponse(res, "Route not found", null, 404);
});

app.use((err, req, res, _next) => {
  if (err?.type === "entity.too.large" || err?.name === "PayloadTooLargeError") {
    return errorResponse(res, "Request body too large", { code: "PAYLOAD_TOO_LARGE" }, 413);
  }
  if (err instanceof AppError) {
    const sc = err.statusCode;
    if (sc >= 500) {
      appLogger.error("Server AppError", {
        statusCode: sc,
        message: err.message,
        stack: err?.stack,
        path: req?.path,
        method: req?.method,
      });
    } else {
      appLogger.info("Client error", {
        statusCode: sc,
        message: err.message,
        path: req?.path,
        method: req?.method,
      });
    }
  } else {
    appLogger.error("Unhandled error", {
      err: err?.message,
      stack: err?.stack,
      path: req?.path,
      method: req?.method,
    });
  }
  return sendExpressErrorResponse(err, req, res);
});

const port = process.env.PORT || 8084;
const listenHost = process.env.LISTEN_HOST || "0.0.0.0";

if (process.env.FLIGHTONE_API_LISTEN !== "false") {
  const server = app.listen(port, listenHost, () => {
    appLogger.info("FlightOne API started", {
      host: listenHost,
      port,
      env: process.env.NODE_ENV || "development",
    });
  });

  installGracefulShutdown({
    server,
    cleanup: async () => {
      await prisma.$disconnect();
    },
  });
}

export default app;

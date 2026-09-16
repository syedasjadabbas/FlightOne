/**
 * Production config + graceful shutdown unit tests.
 * Run: node --test lib/productionConfig.unit.test.js lib/gracefulShutdown.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ProductionConfigError,
  assertProductionBootstrapAdminSafe,
  assertProductionConfigSafe,
  isLocalhostCorsOrigin,
  isObviousExampleBootstrapPassword,
  isObviousExampleJwtSecret,
} from "./productionConfig.js";
import {
  installGracefulShutdown,
  processLifecycle,
} from "./gracefulShutdown.js";

describe("productionConfig", () => {
  it("no-ops outside production", () => {
    assert.doesNotThrow(() =>
      assertProductionConfigSafe({
        NODE_ENV: "development",
        JWT_SECRET: "change-me-in-production-min-32-chars-long",
        ALLOW_SIMULATED_PAYMENT: "true",
      }),
    );
  });

  it("rejects obvious JWT secrets and missing FIELD_ENCRYPTION_KEY in production", () => {
    assert.equal(
      isObviousExampleJwtSecret("change-me-in-production-min-32-chars-long"),
      true,
    );
    assert.throws(
      () =>
        assertProductionConfigSafe({
          NODE_ENV: "production",
          JWT_SECRET: "change-me-in-production-min-32-chars-long",
          CORS_ORIGIN: "https://app.example.com",
        }),
      (err) =>
        err instanceof ProductionConfigError &&
        err.messages.some((m) => m.includes("JWT_SECRET")) &&
        err.messages.some((m) => m.includes("FIELD_ENCRYPTION_KEY")),
    );
  });

  it("rejects localhost CORS and simulated flags in production", () => {
    assert.equal(isLocalhostCorsOrigin("http://localhost:3000"), true);
    assert.throws(
      () =>
        assertProductionConfigSafe({
          NODE_ENV: "production",
          JWT_SECRET: "x7Kq9mP2vR4nL8wY1tH6bC3jF5dA0sE9uZ2",
          FIELD_ENCRYPTION_KEY: "ab".repeat(32),
          CORS_ORIGIN: "http://localhost:3000",
          ALLOW_SIMULATED_PAYMENT: "true",
          ALLOW_SIMULATED_BOOKING: "true",
          PASSWORD_RESET_RETURN_TOKEN: "true",
          VAULT_STORAGE_PROVIDER: "local",
        }),
      (err) =>
        err instanceof ProductionConfigError &&
        err.messages.length >= 5,
    );
  });

  it("accepts a minimal safe production config", () => {
    assert.doesNotThrow(() =>
      assertProductionConfigSafe({
        NODE_ENV: "production",
        JWT_SECRET: "x7Kq9mP2vR4nL8wY1tH6bC3jF5dA0sE9uZ2",
        FIELD_ENCRYPTION_KEY: "ab".repeat(32),
        CORS_ORIGIN: "https://app.flightone.example",
        VAULT_STORAGE_PROVIDER: "unconfigured",
      }),
    );
  });

  it("rejects example bootstrap credentials in production", () => {
    assert.equal(isObviousExampleBootstrapPassword("ChangeMe123!"), true);
    assert.throws(
      () =>
        assertProductionBootstrapAdminSafe({
          NODE_ENV: "production",
          BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
          BOOTSTRAP_ADMIN_PASSWORD: "ChangeMe123!",
        }),
      ProductionConfigError,
    );
  });
});

describe("gracefulShutdown", () => {
  it("closes HTTP server, runs cleanup, and exits 0", async () => {
    processLifecycle.shuttingDown = false;
    let closed = false;
    let cleaned = false;
    let exitCode = null;

    const server = {
      close(cb) {
        closed = true;
        cb?.(null);
      },
      closeIdleConnections() {},
    };

    const { shutdown } = installGracefulShutdown({
      server,
      timeoutMs: 2000,
      registerSignals: false,
      cleanup: async () => {
        cleaned = true;
      },
      exit: (code) => {
        exitCode = code;
      },
      logger: { info() {}, warn() {}, error() {} },
    });

    await shutdown("SIGTERM");
    assert.equal(closed, true);
    assert.equal(cleaned, true);
    assert.equal(exitCode, 0);
    assert.equal(processLifecycle.shuttingDown, true);
  });
});

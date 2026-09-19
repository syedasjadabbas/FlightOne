/**
 * Module 00 — auth audit coverage tests (login + related security events).
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.NODE_ENV = "test";
process.env.PASSWORD_RESET_RETURN_TOKEN = "true";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { sanitizeAuditMetadata } = await import("../../lib/audit.js");
const { sha256Hex, randomToken } = await import("../../lib/crypto.js");
const authService = await import("./auth.service.js");

const suffix = Date.now();
const createdUserIds = [];

async function createUser(label, password = "AuditPass123!") {
  const user = await prisma.user.create({
    data: {
      email: `fo.audit.${label}.${suffix}@example.com`,
      name: `Audit ${label}`,
      passwordHash: await bcrypt.hash(password, 12),
      passwordChangedAt: new Date(Date.now() - 60_000),
      emailVerifiedAt: new Date(),
    },
  });
  createdUserIds.push(user.id);
  return { user, password };
}

function httpRequest(method, pathName, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
          method,
          headers: {
            Accept: "application/json",
            "User-Agent": "FlightOne-AuditTest/1.0",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const contentType = res.headers.get("content-type") || "";
        const json = contentType.includes("application/json")
          ? await res.json()
          : null;
        resolve({ status: res.status, body: json });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

function assertNoSecrets(row) {
  const raw = JSON.stringify(row);
  assert.equal(raw.includes("passwordHash"), false);
  assert.doesNotMatch(raw, /"password"\s*:/);
  assert.doesNotMatch(raw, /"refreshToken"\s*:/);
  assert.doesNotMatch(raw, /"accessToken"\s*:/);
  assert.doesNotMatch(raw, /"tokenHash"\s*:/);
  assert.doesNotMatch(raw, /Bearer\s+/i);
  assert.equal(raw.includes("Authorization"), false);
}

async function auditsFor(userId, action) {
  return prisma.auditLog.findMany({
    where: {
      ...(userId === undefined ? {} : { userId }),
      action,
    },
    orderBy: { createdAt: "desc" },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("sanitizeAuditMetadata", () => {
  it("strips secrets and leaves safe fields", () => {
    const cleaned = sanitizeAuditMetadata({
      outcome: "success",
      password: "secret",
      refreshToken: "raw-refresh",
      authorization: "Bearer abc",
      reason: "logout",
    });
    assert.deepEqual(cleaned, { outcome: "success", reason: "logout" });
  });
});

describe("auth audit logging", () => {
  it("records successful login + session create without duplicates of the same action", async () => {
    const { user, password } = await createUser("ok");
    const before = await prisma.auditLog.count({
      where: { userId: user.id, action: "auth.login" },
    });

    const res = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password },
    });
    assert.equal(res.status, 200);

    const loginRows = await prisma.auditLog.findMany({
      where: { userId: user.id, action: "auth.login" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(loginRows.length, before + 1);
    assert.equal(loginRows[0].metadata.outcome, "success");
    assert.ok(loginRows[0].userAgent);
    assertNoSecrets(loginRows[0]);

    const sessionCreates = await prisma.auditLog.findMany({
      where: { userId: user.id, action: "auth.session.create" },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    assert.ok(sessionCreates.length >= 1);
    assert.equal(
      sessionCreates.filter((r) => r.resourceId === res.body.data.sessionId).length,
      1,
    );
    assertNoSecrets(sessionCreates[0]);
  });

  it("records failed login for wrong password with same public error", async () => {
    const { user } = await createUser("badpass");
    const res = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password: "WrongPass999!" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Invalid credentials");

    const rows = await prisma.auditLog.findMany({
      where: { userId: user.id, action: "auth.login" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    assert.equal(rows[0].metadata.outcome, "failure");
    assert.equal(rows[0].metadata.reason, "invalid_credentials");
    assertNoSecrets(rows[0]);
  });

  it("records failed login for unknown email without leaking existence via API", async () => {
    const unknownEmail = `nobody.audit.${suffix}@example.com`;
    const res = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: unknownEmail, password: "Whatever123!" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Invalid credentials");

    const rows = await prisma.auditLog.findMany({
      where: {
        action: "auth.login",
        userId: null,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    assert.ok(rows.some((r) => r.metadata?.outcome === "failure"));
    const latest = rows[0];
    assert.equal(latest.metadata.reason, "invalid_credentials");
    assert.equal(latest.resourceId, null);
    assertNoSecrets(latest);
    // No email field in metadata (enumeration-safe audit payload).
    assert.equal(Object.hasOwn(latest.metadata || {}, "email"), false);
  });

  it("audits logout/session revoke and revoke-others once each", async () => {
    const { user, password } = await createUser("revoke");
    const login = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password },
    });
    const refreshToken = login.body.data.refreshToken;
    const sessionId = login.body.data.sessionId;

    // Second session to revoke via revoke-others.
    const otherPlain = randomToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomToken(),
        tokenHash: sha256Hex(otherPlain),
        expiresAt: new Date(Date.now() + 86400_000),
        lastUsedAt: new Date(),
      },
    });

    const others = await httpRequest("POST", "/api/v1/auth/sessions/revoke-others", {
      headers: { Authorization: `Bearer ${login.body.data.accessToken}` },
      body: { currentSessionId: sessionId },
    });
    assert.equal(others.status, 200);

    const revokeOthers = await auditsFor(user.id, "auth.session.revoke_others");
    assert.equal(revokeOthers.length, 1);
    assert.equal(revokeOthers[0].metadata.preservedSessionId, sessionId);
    assertNoSecrets(revokeOthers[0]);

    const logout = await httpRequest("POST", "/api/v1/auth/logout", {
      body: { refreshToken },
    });
    assert.equal(logout.status, 200);

    const revokes = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        action: "auth.session.revoke",
        resourceId: sessionId,
      },
    });
    assert.equal(revokes.length, 1);
    assert.equal(revokes[0].metadata.reason, "logout");
    assertNoSecrets(revokes[0]);
  });

  it("audits password reset request and completion without secrets", async () => {
    const { user } = await createUser("reset");
    const issued = await authService.requestPasswordReset(
      { email: user.email },
      {
        env: {
          ...process.env,
          PASSWORD_RESET_RETURN_TOKEN: "true",
          NODE_ENV: "test",
        },
      },
    );

    const reqRows = await auditsFor(user.id, "auth.password_reset.request");
    assert.ok(reqRows.length >= 1);
    assert.equal(reqRows[0].metadata.outcome, "token_issued");
    assertNoSecrets(reqRows[0]);
    assert.equal(JSON.stringify(reqRows[0]).includes(issued._testToken), false);

    const reset = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: issued._testToken, password: "NewerPass456!" },
    });
    assert.equal(reset.status, 200);

    const done = await auditsFor(user.id, "auth.password_reset.complete");
    assert.equal(done.length, 1);
    assert.equal(done[0].metadata.refreshTokensRevoked, true);
    assertNoSecrets(done);
    assert.equal(JSON.stringify(done[0]).includes(issued._testToken), false);
  });

  it("unknown-email password reset still audits without revealing account via API", async () => {
    const email = `ghost.reset.${suffix}@example.com`;
    const res = await httpRequest("POST", "/api/v1/auth/forgot-password", {
      body: { email },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.accepted, true);

    const rows = await prisma.auditLog.findMany({
      where: {
        action: "auth.password_reset.request",
        userId: null,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    assert.ok(rows.some((r) => r.metadata?.outcome === "no_op"));
    assertNoSecrets(rows[0]);
  });
});

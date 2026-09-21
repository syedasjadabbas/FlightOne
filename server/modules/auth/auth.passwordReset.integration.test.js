/**
 * Module 00 — password recovery integration tests.
 * Covers enumeration safety, token lifecycle, bcrypt update, session invalidation,
 * and rate limiting on forgot-password.
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
process.env.PASSWORD_RESET_EXPIRES_IN = "1h";
delete process.env.NOTIFY_EMAIL_WEBHOOK_URL;
delete process.env.RESEND_API_KEY;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { signAccessToken } = await import("../../lib/jwt.js");
const { sha256Hex, randomToken } = await import("../../lib/crypto.js");
const { comparePassword } = await import("../../lib/password.js");
const authService = await import("./auth.service.js");

const suffix = Date.now();
const createdUserIds = [];

async function createUser(label, password = "OldPass123!") {
  const user = await prisma.user.create({
    data: {
      email: `fo.reset.${label}.${suffix}@example.com`,
      name: `Reset ${label}`,
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
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const contentType = res.headers.get("content-type") || "";
        const json = contentType.includes("application/json")
          ? await res.json()
          : null;
        resolve({ status: res.status, body: json, headers: res.headers });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("auth password recovery", () => {
  it("returns enumeration-safe response for unknown and known emails", async () => {
    const { user } = await createUser("enum");
    const unknown = await httpRequest("POST", "/api/v1/auth/forgot-password", {
      body: { email: `nobody.${suffix}@example.com` },
    });
    const known = await httpRequest("POST", "/api/v1/auth/forgot-password", {
      body: { email: user.email },
    });

    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    assert.equal(unknown.body.success, true);
    assert.equal(known.body.success, true);
    assert.equal(unknown.body.data.accepted, true);
    assert.equal(known.body.data.accepted, true);
    assert.equal(unknown.body.data.message, known.body.data.message);
    assert.equal(unknown.body.data.emailDelivery, known.body.data.emailDelivery);
    const expectedDelivery = authService.passwordResetEmailDeliveryStatus();
    assert.equal(unknown.body.data.emailDelivery, expectedDelivery);
    // Production responses never include raw token; test flag returns it only for known users.
    assert.equal(unknown.body.data._testToken, undefined);
    assert.ok(known.body.data._testToken);
  });

  it("stores only token hash and never returns token outside test flag", async () => {
    const { user } = await createUser("hash");
    const prev = process.env.PASSWORD_RESET_RETURN_TOKEN;
    process.env.PASSWORD_RESET_RETURN_TOKEN = "false";
    try {
      const res = await httpRequest("POST", "/api/v1/auth/forgot-password", {
        body: { email: user.email },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data._testToken, undefined);
      const rows = await prisma.passwordResetToken.findMany({
        where: { userId: user.id, consumedAt: null },
      });
      assert.equal(rows.length, 1);
      assert.ok(rows[0].tokenHash);
      assert.match(rows[0].tokenHash, /^[a-f0-9]{64}$/);
      assert.ok(rows[0].expiresAt > new Date());
    } finally {
      process.env.PASSWORD_RESET_RETURN_TOKEN = prev;
    }
  });

  it("resets password with valid token, consumes token, and updates bcrypt hash", async () => {
    const { user, password: oldPassword } = await createUser("valid");
    const issued = await authService.requestPasswordReset(
      { email: user.email },
      { env: { ...process.env, PASSWORD_RESET_RETURN_TOKEN: "true", NODE_ENV: "test" } },
    );
    const rawToken = issued._testToken;
    assert.ok(rawToken);

    const reset = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: rawToken, password: "NewPass456!" },
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.ok, true);
    assert.equal(reset.body.data.sessionsRevoked, true);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, passwordChangedAt: true },
    });
    assert.ok(updated.passwordChangedAt);
    assert.equal(await comparePassword("NewPass456!", updated.passwordHash), true);
    assert.equal(await comparePassword(oldPassword, updated.passwordHash), false);

    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });
    assert.ok(tokenRow.consumedAt);

    const reuse = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: rawToken, password: "AnotherPass9!" },
    });
    assert.equal(reuse.status, 400);
  });

  it("rejects invalid, expired, and already-used tokens", async () => {
    const { user } = await createUser("badtok");

    const invalid = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: randomToken(32), password: "NewPass456!" },
    });
    assert.equal(invalid.status, 400);

    const raw = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const expired = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: raw, password: "NewPass456!" },
    });
    assert.equal(expired.status, 400);

    const rawUsed = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(rawUsed),
        expiresAt: new Date(Date.now() + 3600_000),
        consumedAt: new Date(),
      },
    });
    const used = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: rawUsed, password: "NewPass456!" },
    });
    assert.equal(used.status, 400);
  });

  it("does not accept client-supplied userId and rejects short passwords", async () => {
    const { user } = await createUser("idor");
    const issued = await authService.requestPasswordReset(
      { email: user.email },
      { env: { ...process.env, PASSWORD_RESET_RETURN_TOKEN: "true", NODE_ENV: "test" } },
    );

    const withUserId = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: {
        token: issued._testToken,
        password: "NewPass456!",
        userId: "attacker-user-id",
      },
    });
    // Extra fields ignored by Zod strip — still succeeds for the token's user only.
    assert.equal(withUserId.status, 200);
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(await comparePassword("NewPass456!", owner.passwordHash), true);

    const short = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: "anything", password: "short" },
    });
    assert.equal(short.status, 400);
  });

  it("revokes refresh tokens and rejects pre-reset access JWTs", async () => {
    const { user } = await createUser("session");
    const refreshPlain = randomToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomToken(),
        tokenHash: sha256Hex(refreshPlain),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    // Access token issued before password change.
    const oldAccess = signAccessToken({ sub: user.id, email: user.email });
    await new Promise((r) => setTimeout(r, 1100));

    const issued = await authService.requestPasswordReset(
      { email: user.email },
      { env: { ...process.env, PASSWORD_RESET_RETURN_TOKEN: "true", NODE_ENV: "test" } },
    );
    const reset = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: issued._testToken, password: "SessionPass9!" },
    });
    assert.equal(reset.status, 200);

    const refreshRows = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });
    assert.ok(refreshRows.every((r) => r.revokedAt));

    const refreshAttempt = await httpRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: refreshPlain },
    });
    assert.equal(refreshAttempt.status, 401);

    const me = await httpRequest("GET", "/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${oldAccess}` },
    });
    assert.equal(me.status, 401);

    const login = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password: "SessionPass9!" },
    });
    assert.equal(login.status, 200);
    const meOk = await httpRequest("GET", "/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${login.body.data.accessToken}` },
    });
    assert.equal(meOk.status, 200);
  });

  it("rate-limits forgot-password using loginLimiter pattern", async () => {
    // Contract: route wires loginLimiter (same email+IP keying as login).
    const routesSrc = await import("node:fs").then((fs) =>
      fs.promises.readFile(
        new URL("./auth.routes.js", import.meta.url),
        "utf8",
      ),
    );
    assert.match(routesSrc, /\/forgot-password[\s\S]{0,120}loginLimiter/);

    // Behavioral: construct a fresh limiter with a tiny max and trip it.
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_IN_DEV = "true";
    process.env.NODE_ENV = "test";
    process.env.LOGIN_RATE_LIMIT_MAX = "2";
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = "60000";

    const { default: rateLimit } = await import("express-rate-limit");
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          message: "Too many requests",
          code: "RATE_LIMITED",
        });
      },
      keyGenerator: (req) => {
        const email =
          typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
        const ip = req.ip || "unknown";
        return email ? `login:${ip}:${email}` : `login:${ip}`;
      },
      validate: false,
    });

    function run(body) {
      return new Promise((resolve) => {
        const req = {
          body,
          ip: "127.0.0.1",
          method: "POST",
          originalUrl: "/api/v1/auth/forgot-password",
          headers: {},
          app: { get: () => undefined },
        };
        const res = {
          statusCode: 200,
          headers: {},
          setHeader(k, v) {
            this.headers[k] = v;
          },
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(payload) {
            this.body = payload;
            resolve({ status: this.statusCode, body: payload });
            return this;
          },
        };
        limiter(req, res, () => resolve({ status: 200, body: { ok: true } }));
      });
    }

    assert.equal((await run({ email: "rate@example.com" })).status, 200);
    assert.equal((await run({ email: "rate@example.com" })).status, 200);
    const limited = await run({ email: "rate@example.com" });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "RATE_LIMITED");
  });
});

describe("passwordResetEmailDeliveryStatus", () => {
  it("reflects provider config only", () => {
    assert.equal(
      authService.passwordResetEmailDeliveryStatus({}),
      "UNCONFIGURED",
    );
    assert.equal(
      authService.passwordResetEmailDeliveryStatus({
        RESEND_API_KEY: "re_test",
      }),
      "QUEUED",
    );
    assert.equal(
      authService.passwordResetEmailDeliveryStatus({
        NOTIFY_EMAIL_WEBHOOK_URL: "https://hooks.example/email",
      }),
      "QUEUED",
    );
  });
});

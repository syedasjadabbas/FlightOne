/**
 * Module 00 — device/session management integration tests.
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
const { signAccessToken } = await import("../../lib/jwt.js");
const { sha256Hex, randomToken } = await import("../../lib/crypto.js");
const authService = await import("./auth.service.js");
const { summarizeUserAgent } = await import("./sessionMeta.js");

const suffix = Date.now();
const createdUserIds = [];

async function createUser(label, password = "SessionPass123!") {
  const user = await prisma.user.create({
    data: {
      email: `fo.sess.${label}.${suffix}@example.com`,
      name: `Sess ${label}`,
      passwordHash: await bcrypt.hash(password, 12),
      passwordChangedAt: new Date(Date.now() - 60_000),
      emailVerifiedAt: new Date(),
    },
  });
  createdUserIds.push(user.id);
  return { user, password };
}

async function createRefresh(userId, { userAgent = "Mozilla/5.0 Chrome/120 Windows" } = {}) {
  const plain = randomToken();
  const familyId = randomToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: sha256Hex(plain),
      expiresAt: new Date(Date.now() + 86400_000),
      lastUsedAt: new Date(),
      userAgent,
      ip: "127.0.0.1",
    },
  });
  return { plain, row };
}

function authHeader(user) {
  return {
    Authorization: `Bearer ${signAccessToken({ sub: user.id, email: user.email })}`,
  };
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

function assertNoTokenLeak(payload) {
  const raw = JSON.stringify(payload);
  assert.equal(raw.includes("tokenHash"), false);
  assert.doesNotMatch(raw, /"refreshToken"\s*:/);
  assert.doesNotMatch(raw, /"passwordHash"/);
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

describe("device/session management", () => {
  it("lists own sessions with safe metadata only", async () => {
    const { user } = await createUser("list");
    const a = await createRefresh(user.id, {
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
    });
    await createRefresh(user.id, {
      userAgent: "Mozilla/5.0 (Macintosh) Safari/17.0",
    });

    const res = await httpRequest(
      "GET",
      `/api/v1/auth/sessions?currentSessionId=${encodeURIComponent(a.row.id)}`,
      { headers: authHeader(user) },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.sessions.length, 2);
    assertNoTokenLeak(res.body);

    const current = res.body.data.sessions.find((s) => s.id === a.row.id);
    assert.equal(current.current, true);
    assert.ok(current.createdAt);
    assert.ok(current.lastUsedAt);
    assert.ok(current.expiresAt);
    assert.ok(current.deviceLabel);
    assert.equal(current.deviceLabel, summarizeUserAgent(current.userAgent));
    for (const s of res.body.data.sessions) {
      assert.equal(Object.hasOwn(s, "tokenHash"), false);
      assert.equal(Object.hasOwn(s, "refreshToken"), false);
    }
  });

  it("revokes own session and blocks refresh", async () => {
    const { user } = await createUser("revoke");
    const sess = await createRefresh(user.id);

    const revoked = await httpRequest(
      "DELETE",
      `/api/v1/auth/sessions/${sess.row.id}`,
      { headers: authHeader(user) },
    );
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.data.revokedSessionId, sess.row.id);
    assertNoTokenLeak(revoked.body);

    const refresh = await httpRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: sess.plain },
    });
    assert.equal(refresh.status, 401);

    const row = await prisma.refreshToken.findUnique({ where: { id: sess.row.id } });
    assert.ok(row.revokedAt);
  });

  it("returns 404 when revoking another user's session (IDOR)", async () => {
    const a = await createUser("idor-a");
    const b = await createUser("idor-b");
    const other = await createRefresh(b.user.id);

    const res = await httpRequest(
      "DELETE",
      `/api/v1/auth/sessions/${other.row.id}`,
      { headers: authHeader(a.user) },
    );
    assert.equal(res.status, 404);

    const still = await prisma.refreshToken.findUnique({ where: { id: other.row.id } });
    assert.equal(still.revokedAt, null);
  });

  it("revokes all other sessions while preserving current", async () => {
    const { user } = await createUser("others");
    const keep = await createRefresh(user.id);
    const drop1 = await createRefresh(user.id);
    const drop2 = await createRefresh(user.id);

    const res = await httpRequest("POST", "/api/v1/auth/sessions/revoke-others", {
      headers: authHeader(user),
      body: { currentSessionId: keep.row.id },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.preservedSessionId, keep.row.id);
    assert.equal(res.body.data.revokedCount, 2);
    assertNoTokenLeak(res.body);

    const keepRow = await prisma.refreshToken.findUnique({ where: { id: keep.row.id } });
    assert.equal(keepRow.revokedAt, null);

    const drop1Refresh = await httpRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: drop1.plain },
    });
    assert.equal(drop1Refresh.status, 401);

    const drop2Refresh = await httpRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: drop2.plain },
    });
    assert.equal(drop2Refresh.status, 401);

    const keepRefresh = await httpRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: keep.plain },
    });
    assert.equal(keepRefresh.status, 200);
    assert.ok(keepRefresh.body.data.sessionId);
    assert.ok(keepRefresh.body.data.refreshToken);
    // New rotated session id differs after refresh rotation.
    assert.notEqual(keepRefresh.body.data.sessionId, keep.row.id);
  });

  it("password reset still invalidates all sessions", async () => {
    const { user, password } = await createUser("reset-all");
    const s1 = await createRefresh(user.id);
    const s2 = await createRefresh(user.id);

    const issued = await authService.requestPasswordReset(
      { email: user.email },
      { env: { ...process.env, PASSWORD_RESET_RETURN_TOKEN: "true", NODE_ENV: "test" } },
    );
    const reset = await httpRequest("POST", "/api/v1/auth/reset-password", {
      body: { token: issued._testToken, password: "BrandNewPass9!" },
    });
    assert.equal(reset.status, 200);

    assert.equal(
      (await httpRequest("POST", "/api/v1/auth/refresh", { body: { refreshToken: s1.plain } }))
        .status,
      401,
    );
    assert.equal(
      (await httpRequest("POST", "/api/v1/auth/refresh", { body: { refreshToken: s2.plain } }))
        .status,
      401,
    );

    // Old password no longer works; new does.
    const badLogin = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password },
    });
    assert.equal(badLogin.status, 401);
    const goodLogin = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email: user.email, password: "BrandNewPass9!" },
      headers: { "User-Agent": "Mozilla/5.0 Firefox/128 Linux" },
    });
    assert.equal(goodLogin.status, 200);
    assert.ok(goodLogin.body.data.sessionId);
    assertNoTokenLeak({
      sessions: (
        await httpRequest("GET", "/api/v1/auth/sessions", {
          headers: {
            Authorization: `Bearer ${goodLogin.body.data.accessToken}`,
          },
        })
      ).body,
    });
  });

  it("rejects unauthenticated session list", async () => {
    const res = await httpRequest("GET", "/api/v1/auth/sessions");
    assert.equal(res.status, 401);
  });
});

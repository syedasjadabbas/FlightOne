/**
 * Refresh reuse detection + cookie helpers (unit / service).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.AUTH_RETURN_REFRESH_IN_BODY = "true";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}

const { default: prisma } = await import("../../config/prisma.js");
const auth = await import("./auth.service.js");
const cookies = await import("./auth.cookies.js");
const { sha256Hex } = await import("../../lib/crypto.js");

const suffix = Date.now();
const userIds = [];

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of userIds) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("auth refresh reuse detection", () => {
  it("rotates legitimately and rejects reuse with family revoke", async () => {
    const prevGrace = process.env.REFRESH_ROTATE_GRACE_MS;
    process.env.REFRESH_ROTATE_GRACE_MS = "0";

    const user = await prisma.user.create({
      data: {
        email: `fo.reuse.${suffix}@example.com`,
        name: "Reuse",
        passwordHash: await bcrypt.hash("TestPass123!", 10),
        passwordChangedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);

    try {
      const first = await auth.loginUser(
        { email: user.email, password: "TestPass123!" },
        { req: { headers: {}, ip: "127.0.0.1" } },
      );
      assert.ok(first.refreshToken);
      const oldRefresh = first.refreshToken;

      const rotated = await auth.refreshSession(
        { refreshToken: oldRefresh },
        { req: { headers: {}, ip: "127.0.0.1" } },
      );
      assert.ok(rotated.refreshToken);
      assert.notEqual(rotated.refreshToken, oldRefresh);

      await assert.rejects(
        () => auth.refreshSession({ refreshToken: oldRefresh }, { req: {} }),
        (e) => e.statusCode === 401,
      );

      const familyRows = await prisma.refreshToken.findMany({
        where: { userId: user.id },
      });
      const familyId = familyRows[0]?.familyId;
      assert.ok(familyId);
      const active = familyRows.filter((r) => !r.revokedAt);
      assert.equal(active.length, 0);
      assert.ok(familyRows.every((r) => r.revokedAt));

      await assert.rejects(
        () => auth.refreshSession({ refreshToken: rotated.refreshToken }, { req: {} }),
        (e) => e.statusCode === 401,
      );
    } finally {
      if (prevGrace === undefined) delete process.env.REFRESH_ROTATE_GRACE_MS;
      else process.env.REFRESH_ROTATE_GRACE_MS = prevGrace;
    }
  });

  it("never returns raw tokens in public session DTO", () => {
    const dto = auth.toPublicSession({
      id: "s1",
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(),
      userAgent: "ua",
      ip: "1.1.1.1",
      tokenHash: "should-not-leak",
    });
    const raw = JSON.stringify(dto);
    assert.doesNotMatch(raw, /tokenHash|refreshToken|should-not-leak/);
  });
});

describe("auth cookies helpers", () => {
  it("publicAuthSession strips refreshToken outside test return mode", () => {
    process.env.AUTH_RETURN_REFRESH_IN_BODY = "false";
    const pub = cookies.publicAuthSession({
      accessToken: "a",
      refreshToken: "secret",
      sessionId: "s",
      user: { id: "u", email: "e", name: null },
    });
    assert.equal(pub.refreshToken, undefined);
    assert.equal(pub.accessToken, "a");
    process.env.AUTH_RETURN_REFRESH_IN_BODY = "true";
  });

  it("readRefreshTokenFromRequest prefers cookie", () => {
    const token = cookies.readRefreshTokenFromRequest({
      cookies: { [cookies.REFRESH_COOKIE_NAME]: "from-cookie" },
      body: { refreshToken: "from-body" },
      headers: {},
    });
    assert.equal(token, "from-cookie");
  });

  it("CSRF allows custom header for cookie auth", () => {
    assert.doesNotThrow(() =>
      cookies.assertCookieAuthRequestAllowed(
        { headers: { [cookies.CSRF_HEADER_NAME]: "1" } },
        { usedCookie: true },
      ),
    );
  });
});

// silence unused
void sha256Hex;

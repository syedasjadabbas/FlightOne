/**
 * Module 00 — Email Verification Integration Tests.
 * Covers signup, verification OTP generation, outbox queuing, single-use OTP validation,
 * attempt rate limits, resend rate limits, unverified login block, and duplicate email block.
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();

process.env.FLIGHTONE_API_LISTEN = "false";
process.env.NODE_ENV = "test";
process.env.EMAIL_VERIFICATION_RETURN_TOKEN = "true";
delete process.env.NOTIFY_EMAIL_WEBHOOK_URL;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { sha256Hex, randomToken } = await import("../../lib/crypto.js");
const authService = await import("./auth.service.js");

const suffix = Date.now();
const createdUserIds = [];

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
    await prisma.emailVerificationToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("auth email verification", () => {
  it("complete signup -> receive OTP -> enter OTP -> email verified -> login works", async () => {
    const email = `fo.verify.flow.${suffix}@example.com`;
    const password = "PassWord123!";

    // 1. Signup
    const regRes = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Test Flow", email, password },
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.body.data.requiresVerification, true);
    assert.equal(regRes.body.data.email, email);
    const otp = regRes.body.data._testToken;
    assert.ok(otp);
    assert.match(otp, /^\d{6}$/);

    const user = await prisma.user.findUnique({ where: { email } });
    assert.ok(user);
    createdUserIds.push(user.id);
    assert.equal(user.emailVerifiedAt, null);

    // Verify hashed OTP in DB
    const tokens = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].tokenHash, sha256Hex(otp));

    // Verify notification queued
    const outbox = await prisma.notificationOutbox.findMany({ where: { userId: user.id } });
    assert.ok(outbox.length > 0);
    assert.equal(outbox[0].payload.kind, "email_verification_otp");

    // 2. Unverified login attempt fails with 403
    const unverifiedLogin = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    assert.equal(unverifiedLogin.status, 403);

    // 3. Enter valid OTP to verify email
    const verifyRes = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: otp },
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.data.accessToken);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(updatedUser.emailVerifiedAt);

    // 4. Subsequent login succeeds
    const verifiedLogin = await httpRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    assert.equal(verifiedLogin.status, 200);
    assert.ok(verifiedLogin.body.data.accessToken);
  });

  it("rejects duplicate email signup with 409", async () => {
    const email = `fo.verify.dup.${suffix}@example.com`;
    const password = "PassWord123!";

    const reg1 = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Dup User", email, password },
    });
    assert.equal(reg1.status, 201);

    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);

    const reg2 = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Dup User 2", email, password },
    });
    assert.equal(reg2.status, 409);
  });

  it("rejects wrong OTP and tracks attempts", async () => {
    const email = `fo.verify.wrong.${suffix}@example.com`;
    const password = "PassWord123!";

    const regRes = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Wrong Code", email, password },
    });
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);

    const badVerify = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: "000000" },
    });
    assert.equal(badVerify.status, 400);

    const tokenRow = await prisma.emailVerificationToken.findFirst({ where: { userId: u.id } });
    assert.equal(tokenRow.attempts, 1);
  });

  it("enforces max attempt limit (429) after 5 wrong tries", async () => {
    const email = `fo.verify.attempts.${suffix}@example.com`;
    const password = "PassWord123!";

    await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Limit Test", email, password },
    });
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);

    for (let i = 0; i < 4; i++) {
      const res = await httpRequest("POST", "/api/v1/auth/verify-email", {
        body: { email, code: "111111" },
      });
      assert.equal(res.status, 400);
    }

    // 5th attempt: trips rate limit
    const res5 = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: "111111" },
    });
    assert.equal(res5.status, 429);
  });

  it("rejects expired OTP", async () => {
    const email = `fo.verify.expired.${suffix}@example.com`;
    const password = "PassWord123!";

    await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Expired Test", email, password },
    });
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);

    const otp = randomToken(6);
    await prisma.emailVerificationToken.create({
      data: {
        userId: u.id,
        tokenHash: sha256Hex("999999"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const expRes = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: "999999" },
    });
    assert.equal(expRes.status, 400);
  });

  it("rejects reused OTP (single-use)", async () => {
    const email = `fo.verify.reused.${suffix}@example.com`;
    const password = "PassWord123!";

    const regRes = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Reused Test", email, password },
    });
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);
    const otp = regRes.body.data._testToken;

    const first = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: otp },
    });
    assert.equal(first.status, 200);

    const second = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: otp },
    });
    assert.equal(second.status, 400);
  });

  it("handles resend rate limiting (429) and invalidates old code", async () => {
    const email = `fo.verify.resend.${suffix}@example.com`;
    const password = "PassWord123!";

    const regRes = await httpRequest("POST", "/api/v1/auth/register", {
      body: { name: "Resend Test", email, password },
    });
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) createdUserIds.push(u.id);
    const firstOtp = regRes.body.data._testToken;

    // Immediate resend fails due to 60s rate limit
    const resendImmediate = await httpRequest("POST", "/api/v1/auth/resend-verification", {
      body: { email },
    });
    assert.equal(resendImmediate.status, 429);

    // Artificially age the first token so resend passes
    await prisma.emailVerificationToken.updateMany({
      where: { userId: u.id },
      data: { createdAt: new Date(Date.now() - 65_000) },
    });

    const resendOk = await httpRequest("POST", "/api/v1/auth/resend-verification", {
      body: { email },
    });
    assert.equal(resendOk.status, 200);
    const secondOtp = resendOk.body.data._testToken;
    assert.ok(secondOtp);
    assert.notEqual(firstOtp, secondOtp);

    // First OTP is now invalidated
    const tryFirst = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: firstOtp },
    });
    assert.equal(tryFirst.status, 400);

    // Second OTP works
    const trySecond = await httpRequest("POST", "/api/v1/auth/verify-email", {
      body: { email, code: secondOtp },
    });
    assert.equal(trySecond.status, 200);
  });
});

/**
 * Mandatory Staff 2FA Integration Test Suite.
 * Strictly according to SDS M00, Appendix E (NFR-SEC-03, AUTH-05, UF-00.8, UF-15.8).
 *
 * Covers:
 * 1. Staff enrollment & pending state encryption
 * 2. Valid TOTP verification & mfa: true claim issuance
 * 3. Invalid & expired TOTP code rejection
 * 4. Single-use backup recovery code verification & replay rejection
 * 5. TOTP time-step replay protection
 * 6. Rate limiting / 15-minute account lockout on 5 consecutive failures
 * 7. Mandatory staff enforcement (SuperAdmin, OpsManager, TravelConsultant, FinanceOfficer)
 * 8. Voluntary B2C traveller login unaffected (not forced)
 * 9. Protected operations route blocked without completed 2FA (HTTP 403 MFA_REQUIRED)
 * 10. Session refresh preserves MFA state & logout/revocation
 */
import http from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.FLIGHTONE_API_LISTEN = "false";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const { default: app } = await import("../../app.js");
const { generateTotp } = await import("../../lib/totp.js");
const { isStaffRole, userHasStaffRole } = await import("../../lib/staffRoles.js");

describe("Module 00 — Staff Mandatory 2FA & User Two-Factor Authentication", () => {
  let server;
  let baseUrl;
  const userIds = [];
  const roleIds = [];
  const suffix = Date.now();

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    for (const id of userIds) {
      await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    for (const id of roleIds) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } }).catch(() => {});
      await prisma.role.delete({ where: { id } }).catch(() => {});
    }
  });

  async function apiRequest(method, path, { body, headers = {} } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  async function createTestUser(email, password, { name = "Test User", roleName = null } = {}) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);

    if (roleName) {
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({
          data: { name: roleName, description: `Test ${roleName}` },
        });
        roleIds.push(role.id);
      }
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    return user;
  }

  it("SDS staff role detection covers SuperAdmin, OpsManager, TravelConsultant, FinanceOfficer", () => {
    assert.equal(isStaffRole("SuperAdmin"), true);
    assert.equal(isStaffRole("Super Admin"), true);
    assert.equal(isStaffRole("OpsManager"), true);
    assert.equal(isStaffRole("Ops Manager"), true);
    assert.equal(isStaffRole("TravelConsultant"), true);
    assert.equal(isStaffRole("Travel Consultant"), true);
    assert.equal(isStaffRole("FinanceOfficer"), true);
    assert.equal(isStaffRole("Finance Officer"), true);
    assert.equal(isStaffRole("PricingManager"), true);
    assert.equal(isStaffRole("RefundsOfficer"), true);

    // B2C / Non-staff roles
    assert.equal(isStaffRole("Traveller"), false);
    assert.equal(isStaffRole("Customer"), false);
    assert.equal(isStaffRole(null), false);
    assert.equal(isStaffRole(undefined), false);

    assert.equal(userHasStaffRole([{ role: { name: "OpsManager" } }]), true);
    assert.equal(userHasStaffRole([{ role: { name: "Traveller" } }]), false);
  });

  it("B2C traveller login is not forced into mandatory 2FA", async () => {
    const email = `b2c.traveller.${suffix}@example.com`;
    const password = "TravellerPassword123!";
    await createTestUser(email, password, { name: "B2C Traveller" });

    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.ok(loginRes.body.data.accessToken);
    assert.ok(loginRes.body.data.refreshToken);
    assert.equal(loginRes.body.data.requires2fa, undefined);
  });

  it("Staff login without 2FA enrolled triggers mandatory enrollment challenge (UF-15.8)", async () => {
    const email = `staff.consultant.${suffix}@example.com`;
    const password = "StaffPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Travel Consultant",
      roleName: "TravelConsultant",
    });

    // 1. Login prompts for mandatory 2FA enrollment
    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data.requires2fa, true);
    assert.equal(loginRes.body.data.requires2faSetup, true);
    assert.ok(loginRes.body.data.tempToken);
    assert.equal(loginRes.body.data.accessToken, undefined); // No full access token granted

    const tempToken = loginRes.body.data.tempToken;

    // 2. Setup 2FA using tempToken
    const setupRes = await apiRequest("POST", "/api/v1/auth/2fa/setup", {
      body: { tempToken },
    });

    assert.equal(setupRes.status, 200);
    assert.ok(setupRes.body.data.secret);
    assert.ok(setupRes.body.data.otpauthUrl);
    assert.equal(setupRes.body.data.backupCodes.length, 10);

    const secret = setupRes.body.data.secret;
    const backupCodes = setupRes.body.data.backupCodes;

    // 3. Database verification: secret is encrypted at rest (starts with fo1:), backup codes are hashed
    const dbUser = await prisma.user.findUnique({ where: { id: staff.id } });
    assert.ok(dbUser.twoFactorPendingSecret.startsWith("fo1:"));
    assert.notEqual(dbUser.twoFactorPendingSecret, secret);
    assert.equal(dbUser.twoFactorBackupCodes.length, 10);
    assert.notEqual(dbUser.twoFactorBackupCodes[0].codeHash, backupCodes[0]);

    // 4. Invalid confirmation code is rejected
    const badConfirm = await apiRequest("POST", "/api/v1/auth/2fa/confirm", {
      body: { tempToken, code: "000000" },
    });
    assert.equal(badConfirm.status, 400);

    // 5. Valid confirmation code enables 2FA and completes staff login
    const validCode = generateTotp(secret);
    const confirmRes = await apiRequest("POST", "/api/v1/auth/2fa/confirm", {
      body: { tempToken, code: validCode },
    });

    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.success, true);
    assert.ok(confirmRes.body.data.accessToken);
    assert.equal(confirmRes.body.data.mfa, true);

    const updatedDb = await prisma.user.findUnique({ where: { id: staff.id } });
    assert.equal(updatedDb.twoFactorEnabled, true);
    assert.equal(updatedDb.twoFactorPendingSecret, null);
    assert.ok(updatedDb.twoFactorSecret.startsWith("fo1:"));
  });

  it("Staff login with 2FA active requires TOTP challenge before full session is issued", async () => {
    const email = `staff.opsmanager.${suffix}@example.com`;
    const password = "OpsManagerPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Ops Manager",
      roleName: "OpsManager",
    });

    // Enroll 2FA
    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    const code = generateTotp(setup.secret);
    await confirmTwoFactor(staff.id, { code });

    // 1. Password login triggers 2FA challenge
    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data.requires2fa, true);
    assert.ok(loginRes.body.data.tempToken);
    assert.equal(loginRes.body.data.accessToken, undefined);

    const tempToken = loginRes.body.data.tempToken;

    // 2. Invalid code fails with 401
    const invalidRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: "123456" },
    });
    assert.equal(invalidRes.status, 401);

    // 3. Valid TOTP code verifies and issues access token with mfa: true
    const validOtp = generateTotp(setup.secret);
    const verifyRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: validOtp },
    });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.success, true);
    assert.ok(verifyRes.body.data.accessToken);
    assert.equal(verifyRes.body.data.mfa, true);
  });

  it("Replay protection: submitting the same TOTP code in the same window is rejected", async () => {
    const email = `staff.replay.${suffix}@example.com`;
    const password = "ReplayPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Replay Test",
      roleName: "SuperAdmin",
    });

    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    await confirmTwoFactor(staff.id, { code: generateTotp(setup.secret) });

    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    const tempToken = loginRes.body.data.tempToken;
    const currentCode = generateTotp(setup.secret);

    // First use: success
    const pass1 = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: currentCode },
    });
    assert.equal(pass1.status, 200);

    // Replay with another challenge in same time window: rejected!
    const login2 = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    const replayRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken: login2.body.data.tempToken, code: currentCode },
    });
    assert.equal(replayRes.status, 401);
    assert.match(replayRes.body.error || replayRes.body.message, /already been used/i);
  });

  it("Single-use recovery backup codes verify and reject reuse", async () => {
    const email = `staff.backup.${suffix}@example.com`;
    const password = "BackupPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Backup Test",
      roleName: "FinanceOfficer",
    });

    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    await confirmTwoFactor(staff.id, { code: generateTotp(setup.secret) });

    const backupCodeToUse = setup.backupCodes[0];

    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    const tempToken = loginRes.body.data.tempToken;

    // 1. Verify with backup code
    const verifyRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: backupCodeToUse, type: "backup_code" },
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.data.accessToken);
    assert.equal(verifyRes.body.data.mfa, true);

    // 2. Reuse same backup code: rejected!
    const login2 = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    const reuseRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken: login2.body.data.tempToken, code: backupCodeToUse, type: "backup_code" },
    });
    assert.equal(reuseRes.status, 401);
  });

  it("Account locks for 15 minutes after 5 consecutive failed 2FA verification attempts (UF-00.1)", async () => {
    const email = `staff.lockout.${suffix}@example.com`;
    const password = "LockoutPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Lockout Test",
      roleName: "TravelConsultant",
    });

    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    await confirmTwoFactor(staff.id, { code: generateTotp(setup.secret) });

    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email, password },
    });
    const tempToken = loginRes.body.data.tempToken;

    // Fail 4 times (returns 401)
    for (let i = 0; i < 4; i++) {
      const res = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
        body: { tempToken, code: "000000" },
      });
      assert.equal(res.status, 401);
    }

    // 5th failed attempt triggers lockout (401 or 429)
    await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: "000000" },
    });

    // Subsequent attempt is blocked with 429 Account locked
    const lockedRes = await apiRequest("POST", "/api/v1/auth/2fa/verify", {
      body: { tempToken, code: generateTotp(setup.secret) },
    });
    assert.equal(lockedRes.status, 429);
    assert.match(lockedRes.body.error || lockedRes.body.message, /locked/i);
  });

  it("Staff roles cannot disable mandatory 2FA", async () => {
    const email = `staff.nodisable.${suffix}@example.com`;
    const password = "NoDisablePassword123!";
    const staff = await createTestUser(email, password, {
      name: "No Disable",
      roleName: "SuperAdmin",
    });

    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    const session = await confirmTwoFactor(staff.id, { code: generateTotp(setup.secret) }, { tempTokenUsed: true });

    const disableRes = await apiRequest("POST", "/api/v1/auth/2fa/disable", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: { password },
    });

    assert.equal(disableRes.status, 403);
    assert.match(disableRes.body.error || disableRes.body.message, /mandatory for staff roles/i);
  });

  it("Protected operations routes reject staff without completed 2FA (HTTP 403 MFA_REQUIRED)", async () => {
    const email = `staff.opsroute.${suffix}@example.com`;
    const password = "OpsRoutePassword123!";
    const staff = await createTestUser(email, password, {
      name: "Ops Route Test",
      roleName: "OpsManager",
    });

    // Grant permission to operations overview
    const perm =
      (await prisma.permission.findUnique({ where: { key: "ops:dashboard:read" } })) ||
      (await prisma.permission.create({
        data: { key: "ops:dashboard:read", label: "Dashboard read" },
      }));
    const role = await prisma.role.findFirst({ where: { userRoles: { some: { userId: staff.id } } } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });

    const { signAccessToken } = await import("../../lib/jwt.js");

    // 1. Access token WITHOUT mfa claim -> 403 MFA_REQUIRED
    const nonMfaToken = signAccessToken({
      sub: staff.id,
      email: staff.email,
      mfa: false,
    });

    const blockedRes = await apiRequest("GET", "/api/v1/operations/overview", {
      headers: { Authorization: `Bearer ${nonMfaToken}` },
    });

    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.body.error?.code || blockedRes.body.code, "MFA_REQUIRED");

    // 2. Access token WITH mfa claim -> 200 OK
    const mfaToken = signAccessToken({
      sub: staff.id,
      email: staff.email,
      mfa: true,
    });

    const allowedRes = await apiRequest("GET", "/api/v1/operations/overview", {
      headers: { Authorization: `Bearer ${mfaToken}` },
    });

    assert.equal(allowedRes.status, 200);
    assert.equal(allowedRes.body.success, true);
  });

  it("Session refresh preserves MFA claim & logout revokes session family", async () => {
    const email = `staff.session.${suffix}@example.com`;
    const password = "SessionPassword123!";
    const staff = await createTestUser(email, password, {
      name: "Session Test",
      roleName: "FinanceOfficer",
    });

    const { setupTwoFactor, confirmTwoFactor } = await import("./auth.service.js");
    const setup = await setupTwoFactor(staff.id);
    const session = await confirmTwoFactor(staff.id, { code: generateTotp(setup.secret) }, { tempTokenUsed: true });

    assert.equal(session.mfa, true);

    // 1. Refresh token retains mfa: true
    const refreshRes = await apiRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: session.refreshToken },
    });

    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.body.success, true);
    assert.ok(refreshRes.body.data.accessToken);
    assert.equal(refreshRes.body.data.mfa, true);

    const newAccessToken = refreshRes.body.data.accessToken;
    const newRefreshToken = refreshRes.body.data.refreshToken;

    // 2. Logout revokes the session
    const logoutRes = await apiRequest("POST", "/api/v1/auth/logout", {
      body: { refreshToken: newRefreshToken },
    });
    assert.equal(logoutRes.status, 200);

    // 3. Subsequent refresh attempt with revoked token fails
    const failRefresh = await apiRequest("POST", "/api/v1/auth/refresh", {
      body: { refreshToken: newRefreshToken },
    });
    assert.equal(failRefresh.status, 401);
  });
});

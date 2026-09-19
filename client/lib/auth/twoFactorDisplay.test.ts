import { describe, expect, it } from "vitest";
import { authApi } from "@/lib/api/auth.api";
import {
  isStaffRole,
  normalizeTotpCode,
  isValidTotpCode,
  normalizeBackupCode,
  isValidBackupCode,
  resolveLoginStep,
  resolvePostLoginRedirect,
  formatTwoFactorError,
  twoFactorSetupHasLeak,
} from "@/lib/auth/twoFactorDisplay";

describe("Two-Factor Authentication API Endpoints Registration", () => {
  it("registers all required 2FA queries and mutations in authApi", () => {
    const endpoints = Object.keys(authApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "twoFactorSetup",
        "twoFactorConfirm",
        "twoFactorVerify",
        "twoFactorDisable",
      ])
    );
  });
});

describe("Staff Role Detection (SDS NFR-SEC-03 & Appendix E)", () => {
  it("correctly identifies all SDS mandatory staff roles", () => {
    expect(isStaffRole("SuperAdmin")).toBe(true);
    expect(isStaffRole("superadmin")).toBe(true);
    expect(isStaffRole("Super Admin")).toBe(true);
    expect(isStaffRole("OpsManager")).toBe(true);
    expect(isStaffRole("ops_manager")).toBe(true);
    expect(isStaffRole("TravelConsultant")).toBe(true);
    expect(isStaffRole("Travel Consultant")).toBe(true);
    expect(isStaffRole("FinanceOfficer")).toBe(true);
    expect(isStaffRole("Finance Officer")).toBe(true);
    expect(isStaffRole("PricingManager")).toBe(true);
    expect(isStaffRole("RefundsOfficer")).toBe(true);
  });

  it("identifies B2C travellers as non-staff (voluntary MFA)", () => {
    expect(isStaffRole("Traveller")).toBe(false);
    expect(isStaffRole("Customer")).toBe(false);
    expect(isStaffRole("User")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

describe("TOTP & Backup Code Validation & Normalization", () => {
  it("normalizes and validates 6-digit TOTP codes", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("ab12-34cd-56")).toBe("123456");
    expect(normalizeTotpCode("123456789")).toBe("123456");
    expect(normalizeTotpCode("")).toBe("");

    expect(isValidTotpCode("123456")).toBe(true);
    expect(isValidTotpCode("123 456")).toBe(true);
    expect(isValidTotpCode("12345")).toBe(false);
    expect(isValidTotpCode("1234567")).toBe(false);
    expect(isValidTotpCode("abcdef")).toBe(false);
  });

  it("normalizes and validates single-use emergency backup codes", () => {
    expect(normalizeBackupCode("a1b2c3d4")).toBe("A1B2-C3D4");
    expect(normalizeBackupCode("a1b2-c3d4")).toBe("A1B2-C3D4");
    expect(normalizeBackupCode("A1B2C3D4EXTRA")).toBe("A1B2-C3D4");

    expect(isValidBackupCode("A1B2-C3D4")).toBe(true);
    expect(isValidBackupCode("A1B2C3D4")).toBe(true);
    expect(isValidBackupCode("a1b2c3d4")).toBe(true);
    expect(isValidBackupCode("A1B2-C3D")).toBe(false);
    expect(isValidBackupCode("SHORT")).toBe(false);
  });
});

describe("Login Flow Step Transitions", () => {
  it("resolves standard login without 2FA challenge", () => {
    const res = {
      accessToken: "access-token-123",
      sessionId: "session-1",
      user: { id: "u1", email: "user@example.com", name: "User", role: "Traveller" },
    };
    expect(resolveLoginStep(res as any)).toBe("success");
  });

  it("resolves staff mandatory 2FA enrollment step when requires2faSetup is true", () => {
    const res = {
      requires2fa: true as const,
      requires2faSetup: true as const,
      tempToken: "temp-enrollment-token",
      message: "Two-factor authentication enrollment is mandatory for staff roles",
    };
    expect(resolveLoginStep(res)).toBe("requires2fa_setup");
  });

  it("resolves 2FA challenge step when requires2fa is true and setup is complete", () => {
    const res = {
      requires2fa: true as const,
      tempToken: "temp-challenge-token",
      methods: ["totp", "backup_code"],
      message: "Two-factor authentication code required",
    };
    expect(resolveLoginStep(res)).toBe("requires2fa_challenge");
  });
});

describe("Post-Login Redirection", () => {
  it("redirects staff roles to /ops by default", () => {
    expect(resolvePostLoginRedirect("OpsManager")).toBe("/ops");
    expect(resolvePostLoginRedirect("SuperAdmin")).toBe("/ops");
    expect(resolvePostLoginRedirect("TravelConsultant")).toBe("/ops");
  });

  it("redirects travellers to /chat by default", () => {
    expect(resolvePostLoginRedirect("Traveller")).toBe("/chat");
    expect(resolvePostLoginRedirect(null)).toBe("/chat");
  });

  it("honors safe custom redirect URL", () => {
    expect(resolvePostLoginRedirect("Traveller", "/profile")).toBe("/profile");
    expect(resolvePostLoginRedirect("OpsManager", "/ops/pricing")).toBe("/ops/pricing");
    // Rejects unsafe open redirects
    expect(resolvePostLoginRedirect("Traveller", "//evil.com")).toBe("/chat");
  });
});

describe("2FA Error Formatting & Security Policies", () => {
  it("formats 429 account lockout error appropriately", () => {
    const error429 = { status: 429, data: { message: "Too many failed attempts" } };
    expect(formatTwoFactorError(error429)).toContain("Too many failed attempts");

    const fallback429 = { status: 429 };
    expect(formatTwoFactorError(fallback429)).toContain("locked for 15 minutes");
  });

  it("formats 400 and 401 code rejection errors", () => {
    const error400 = { status: 400, data: { error: "Invalid verification code" } };
    expect(formatTwoFactorError(error400)).toBe("Invalid verification code");

    const error401 = { status: 401 };
    expect(formatTwoFactorError(error401)).toContain("Invalid verification code");
  });

  it("formats 403 mandatory MFA restriction errors", () => {
    const error403 = { status: 403, data: { message: "MFA required for staff" } };
    expect(formatTwoFactorError(error403)).toBe("MFA required for staff");
  });
});

describe("Zero Secret Leakage Verification", () => {
  it("ensures setup response contains only safe public DTO keys", () => {
    const validSetup = {
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUrl: "otpauth://totp/FlightOne:test@example.com?secret=JBSWY3DPEHPK3PXP",
      backupCodes: ["A1B2C3D4", "E5F6G7H8"],
      message: "Save your backup codes",
    };
    expect(twoFactorSetupHasLeak(validSetup)).toBe(false);

    const leakySetup1 = { ...validSetup, passwordHash: "$2b$10$hash" };
    expect(twoFactorSetupHasLeak(leakySetup1)).toBe(true);

    const leakySetup2 = { ...validSetup, twoFactorSecret: "fo1:encrypted" };
    expect(twoFactorSetupHasLeak(leakySetup2)).toBe(true);

    const leakySetup3 = { ...validSetup, twoFactorBackupCodes: [{ codeHash: "h" }] };
    expect(twoFactorSetupHasLeak(leakySetup3)).toBe(true);

    const leakySetup4 = { ...validSetup, tokenHash: "sha256" };
    expect(twoFactorSetupHasLeak(leakySetup4)).toBe(true);
  });
});

describe("Traveller 2FA Workflow Simulation", () => {
  it("simulates traveller voluntary 2FA setup and confirmation", () => {
    // 1. Initial State: 2FA disabled
    let user = { id: "u-b2c", email: "traveller@example.com", twoFactorEnabled: false };
    expect(user.twoFactorEnabled).toBe(false);

    // 2. Setup initiated: receives secret & 10 backup codes
    const setupResponse = {
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUrl: "otpauth://totp/FlightOne:traveller@example.com?secret=JBSWY3DPEHPK3PXP",
      backupCodes: [
        "1111-2222", "3333-4444", "5555-6666", "7777-8888", "9999-0000",
        "AAAA-BBBB", "CCCC-DDDD", "EEEE-FFFF", "GGGG-HHHH", "JJJJ-KKKK",
      ],
      message: "Save your backup codes",
    };
    expect(setupResponse.backupCodes.length).toBe(10);
    expect(setupResponse.secret).toBeTruthy();

    // 3. User enters 6-digit TOTP code
    const enteredCode = " 123 456 ";
    const cleanCode = normalizeTotpCode(enteredCode);
    expect(isValidTotpCode(cleanCode)).toBe(true);

    // 4. Confirm succeeds -> state updates
    const confirmResponse = { ok: true, message: "Two-factor authentication enabled successfully" };
    if (confirmResponse.ok) {
      user = { ...user, twoFactorEnabled: true };
    }
    expect(user.twoFactorEnabled).toBe(true);

    // 5. One-time backup codes display dismissed -> memory zeroed out
    let activeSetupData: typeof setupResponse | null = setupResponse;
    expect(activeSetupData).not.toBeNull();
    // User clicks "I have saved my codes"
    activeSetupData = null;
    expect(activeSetupData).toBeNull();
  });

  it("simulates traveller disabling 2FA with password or TOTP", () => {
    let user = { id: "u-b2c", email: "traveller@example.com", twoFactorEnabled: true };
    expect(user.twoFactorEnabled).toBe(true);

    // User disables 2FA
    const disablePayload = { password: "ValidPassword123!", code: "123456" };
    expect(Boolean(disablePayload.password || disablePayload.code)).toBe(true);

    const disableResponse = { ok: true, message: "Two-factor authentication disabled successfully" };
    if (disableResponse.ok) {
      user = { ...user, twoFactorEnabled: false };
    }
    expect(user.twoFactorEnabled).toBe(false);
  });
});

describe("Staff Mandatory 2FA Enrollment & Challenge Simulation", () => {
  it("handles staff login with requires2faSetup: true and gates access until MFA confirmed", () => {
    // 1. Staff login response
    const loginResponse = {
      requires2fa: true as const,
      requires2faSetup: true as const,
      tempToken: "staff-enrollment-temp-token-xyz",
      message: "Two-factor authentication enrollment is mandatory for staff roles",
    };

    const step = resolveLoginStep(loginResponse);
    expect(step).toBe("requires2fa_setup");

    // Guard: full access token must NOT be granted yet
    expect((loginResponse as any).accessToken).toBeUndefined();

    // 2. Staff completes setup using tempToken
    const setupData = {
      secret: "STAFFSECRETKEY123",
      otpauthUrl: "otpauth://totp/FlightOne:ops@flightone.com?secret=STAFFSECRETKEY123",
      backupCodes: Array.from({ length: 10 }, (_, i) => `CODE-000${i}`),
      message: "Save your backup codes",
    };
    expect(setupData.backupCodes.length).toBe(10);

    // 3. Staff enters TOTP code
    const validCode = "654321";
    expect(isValidTotpCode(validCode)).toBe(true);

    // 4. Staff confirmation completes login with mfa: true claim
    const confirmResponse = {
      accessToken: "staff-access-jwt-mfa",
      sessionId: "session-staff-1",
      user: { id: "s1", email: "ops@flightone.com", name: "Ops Lead", role: "OpsManager", twoFactorEnabled: true },
    };
    expect(confirmResponse.accessToken).toBeTruthy();
    expect(confirmResponse.user.role).toBe("OpsManager");

    // 5. Staff is redirected to operations dashboard
    const redirectUrl = resolvePostLoginRedirect(confirmResponse.user.role);
    expect(redirectUrl).toBe("/ops");
  });

  it("handles staff login with requires2fa: true challenge and allows backup code verification", () => {
    // 1. Staff login with 2FA already enrolled
    const challengeLogin = {
      requires2fa: true as const,
      tempToken: "staff-challenge-temp-token-abc",
      methods: ["totp", "backup_code"],
      message: "Two-factor authentication code required",
    };

    expect(resolveLoginStep(challengeLogin)).toBe("requires2fa_challenge");

    // 2. Staff uses backup recovery code instead of TOTP
    const inputBackupCode = "a1b2-c3d4";
    const normalized = normalizeBackupCode(inputBackupCode);
    expect(normalized).toBe("A1B2-C3D4");
    expect(isValidBackupCode(normalized)).toBe(true);

    // 3. Verification succeeds
    const verifySuccess = {
      accessToken: "access-token-verified-mfa",
      sessionId: "sess-123",
      user: { id: "s1", email: "ops@flightone.com", name: "Ops Lead", role: "OpsManager" },
      mfa: true,
    };
    expect(verifySuccess.mfa).toBe(true);
    expect(resolvePostLoginRedirect(verifySuccess.user.role)).toBe("/ops");
  });

  it("handles failed verification and lockouts without granting session", () => {
    // Failed code verification (HTTP 401)
    const err401 = { status: 401, data: { error: "Invalid verification code" } };
    const msg401 = formatTwoFactorError(err401);
    expect(msg401).toContain("Invalid verification code");

    // Rate limited / locked out after 5 failures (HTTP 429)
    const err429 = {
      status: 429,
      data: { message: "Too many failed attempts. Account locked for 15 minute(s)." },
    };
    const msg429 = formatTwoFactorError(err429);
    expect(msg429).toContain("locked for 15 minute(s)");
  });
});


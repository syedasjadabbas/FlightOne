import type { LoginResponse } from "@/lib/api/auth.api";

/**
 * SDS Defined Staff Roles (M00, Appendix E).
 * MFA is mandatory for staff roles accessing PII and financial records.
 */
export const SDS_STAFF_ROLES = [
  "superadmin",
  "super_admin",
  "super admin",
  "opsmanager",
  "ops_manager",
  "ops manager",
  "travelconsultant",
  "travel_consultant",
  "travel consultant",
  "financeofficer",
  "finance_officer",
  "finance officer",
  "pricingmanager",
  "pricing_manager",
  "pricing manager",
  "refundsofficer",
  "refunds_officer",
  "refunds officer",
] as const;

export function isStaffRole(roleName?: string | null): boolean {
  if (!roleName || typeof roleName !== "string") return false;
  const normalized = roleName.trim().toLowerCase();
  return SDS_STAFF_ROLES.some((r) => r === normalized);
}

export function normalizeTotpCode(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/\D/g, "").slice(0, 6);
}

export function isValidTotpCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const digits = code.replace(/\D/g, "");
  return digits.length === 6;
}

export function normalizeBackupCode(input: string): string {
  if (!input || typeof input !== "string") return "";
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (cleaned.length > 4) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned;
}

export function isValidBackupCode(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{8}$/.test(cleaned);
}

export type LoginStep = "success" | "requires2fa_setup" | "requires2fa_challenge";

export function resolveLoginStep(response: LoginResponse): LoginStep {
  if ("requires2fa" in response && response.requires2fa) {
    if ("requires2faSetup" in response && response.requires2faSetup) {
      return "requires2fa_setup";
    }
    return "requires2fa_challenge";
  }
  return "success";
}

export function resolvePostLoginRedirect(
  role?: string | null,
  requestedRedirect?: string | null,
): string {
  if (requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")) {
    return requestedRedirect;
  }
  if (isStaffRole(role)) {
    return "/ops";
  }
  return "/chat";
}

export function formatTwoFactorError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  // RTK Query FetchBaseQueryError or serialized error
  const status = error.status ?? error?.originalStatus;
  const data = error.data;
  const serverMsg = typeof data === "object" ? data?.error || data?.message : null;

  if (status === 429) {
    return (
      serverMsg ||
      "Too many failed verification attempts. Your account is temporarily locked for 15 minutes."
    );
  }

  if (status === 401 || status === 400) {
    return (
      serverMsg ||
      "Invalid verification code. Please check your authenticator app or backup code and try again."
    );
  }

  if (status === 403) {
    return serverMsg || "Two-factor authentication is mandatory and cannot be bypassed.";
  }

  if (serverMsg) return serverMsg;
  if (typeof error.message === "string") return error.message;

  return "Verification failed. Please ensure your device clock is synchronized and try again.";
}

/** Check that one-time setup response does not leak internal server fields. */
export function twoFactorSetupHasLeak(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const forbidden = ["passwordHash", "twoFactorSecret", "twoFactorBackupCodes", "tokenHash"];
  return forbidden.some((key) => key in data);
}

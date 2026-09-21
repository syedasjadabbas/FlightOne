/**
 * SDS Staff & Operations Role Definitions.
 * Strictly according to SDS M00, Appendix E (NFR-SEC-03, AUTH-05, UF-00.8, UF-15.8).
 *
 * Mandatory 2FA Roles:
 * - SuperAdmin
 * - OpsManager
 * - TravelConsultant
 * - FinanceOfficer
 * - PricingManager
 * - RefundsOfficer
 */

export const SDS_STAFF_ROLES = [
  "SuperAdmin",
  "OpsManager",
  "TravelConsultant",
  "FinanceOfficer",
  "PricingManager",
  "RefundsOfficer",
];

// Normalized lookup set (lowercase, spaces/underscores/hyphens removed)
const NORMALIZED_STAFF_ROLES = new Set([
  "superadmin",
  "opsmanager",
  "travelconsultant",
  "financeofficer",
  "pricingmanager",
  "refundsofficer",
  // Common variants found in seeds / administrative roles
  "super admin",
  "ops manager",
  "travel consultant",
  "finance officer",
  "pricing manager",
  "refunds officer",
  "admin",
  "ops",
  "operations",
  "finance",
  "consultant",
].map((r) => r.toLowerCase().replace(/[\s_-]/g, "")));

/**
 * Check if a role name is an SDS staff / operations role.
 * @param {string|null|undefined} roleName
 * @returns {boolean}
 */
export function isStaffRole(roleName) {
  if (!roleName || typeof roleName !== "string") return false;
  const normalized = roleName.toLowerCase().replace(/[\s_-]/g, "");
  return NORMALIZED_STAFF_ROLES.has(normalized);
}

/**
 * Platform Super Admin (`Super Admin` / `SuperAdmin` / `super_admin`).
 * @param {string|null|undefined} roleName
 * @returns {boolean}
 */
export function isSuperAdminRole(roleName) {
  if (!roleName || typeof roleName !== "string") return false;
  const normalized = roleName.toLowerCase().replace(/[\s_-]/g, "");
  return normalized === "superadmin";
}

/**
 * Check if a user's role assignments contain at least one staff role.
 * @param {Array<{ role?: { name: string }, roleName?: string, name?: string }>} userRoles
 * @returns {boolean}
 */
export function userHasStaffRole(userRoles) {
  if (!Array.isArray(userRoles)) return false;
  return userRoles.some((ur) => {
    const name = ur?.role?.name || ur?.roleName || ur?.name;
    return isStaffRole(name);
  });
}

/**
 * Check if a user's role assignments include platform Super Admin.
 * @param {Array<{ role?: { name: string }, roleName?: string, name?: string }>} userRoles
 * @returns {boolean}
 */
export function userHasSuperAdminRole(userRoles) {
  if (!Array.isArray(userRoles)) return false;
  return userRoles.some((ur) => {
    const name = ur?.role?.name || ur?.roleName || ur?.name;
    return isSuperAdminRole(name);
  });
}

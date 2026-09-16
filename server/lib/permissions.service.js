/**
 * Effective permission resolution for the `resource:action` entitlement model
 * (see docs/modules/00-foundation-security.md).
 *
 * Company-scoped grants in `byCompany` NEVER satisfy a check that omits
 * `companyId` — that fallthrough was an IDOR/isolation hazard. Use:
 * - global permissions for ops-wide keys, or
 * - pass the concrete companyId, or
 * - `opts.allowAnyCompany: true` only for intentional cross-company admin tools.
 *
 * Caching: in-memory TTL + per-request memoization.
 */
import prisma from "../config/prisma.js";
import { memoizePerRequest } from "./request-context.js";

const CACHE_TTL_MS = 120 * 1000;
/** @type {Map<string, { data: { global: string[], byCompany: Record<string,string[]> }, expiresAt: number }>} */
const cache = new Map();

export function invalidateUserPermissionCache(userId) {
  cache.delete(userId);
}

export function clearPermissionCache() {
  cache.clear();
}

async function loadFromDb(userId) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      companyId: true,
      role: {
        select: {
          permissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  const globalKeys = new Set();
  const byCompany = new Map();

  for (const ur of userRoles) {
    const keys = ur.role.permissions.map((rp) => rp.permission.key);
    if (!ur.companyId) {
      keys.forEach((k) => globalKeys.add(k));
    } else {
      if (!byCompany.has(ur.companyId)) byCompany.set(ur.companyId, new Set());
      const set = byCompany.get(ur.companyId);
      keys.forEach((k) => set.add(k));
    }
  }

  return {
    global: [...globalKeys],
    byCompany: Object.fromEntries(
      [...byCompany.entries()].map(([companyId, set]) => [companyId, [...set]]),
    ),
  };
}

export async function getEffectivePermissions(userId) {
  return memoizePerRequest(`perm:${userId}`, async () => {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const data = await loadFromDb(userId);
    cache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
}

/**
 * @param {{ global?: string[], byCompany?: Record<string, string[]> } | null | undefined} eff
 * @param {string} permissionKey
 * @param {string | null | undefined} companyId
 * @param {{ allowAnyCompany?: boolean }} [opts]
 */
export function hasPermissionEff(eff, permissionKey, companyId, opts = {}) {
  if (!eff || !permissionKey) return false;
  if (eff.global?.includes(permissionKey)) return true;

  if (companyId) {
    return Boolean(eff.byCompany?.[companyId]?.includes(permissionKey));
  }

  // No company context: company-scoped grants must NOT apply unless explicitly opted in.
  if (opts.allowAnyCompany === true) {
    for (const keys of Object.values(eff.byCompany || {})) {
      if (keys?.includes(permissionKey)) return true;
    }
  }
  return false;
}

export async function userHasPermission(userId, permissionKey, companyId, opts = {}) {
  const eff = await getEffectivePermissions(userId);
  return hasPermissionEff(eff, permissionKey, companyId, opts);
}

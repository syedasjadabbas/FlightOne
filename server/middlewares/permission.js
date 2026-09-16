import { AppError } from "../lib/customError.js";
import { hasPermissionEff, userHasPermission } from "../lib/permissions.service.js";

function resolveCompanyId(req, opts = {}) {
  const param = opts.param ?? "companyId";
  const from = opts.companyIdFrom;
  if (from === "params") return req.params[param];
  if (from === "query") return req.query[param];
  if (from === "body") return req.body?.[param];
  return undefined;
}

async function permissionGranted(req, permissionKey, companyId, opts = {}) {
  const eff = req.permissions;
  if (eff instanceof Set) {
    return eff.has("*") || eff.has(permissionKey);
  }
  if (eff) {
    return hasPermissionEff(eff, permissionKey, companyId, opts);
  }
  return userHasPermission(req.user.id, permissionKey, companyId, opts);
}

/**
 * Require a `resource:action` permission key. Mount after `requireAuth` (needs `req.user`;
 * reuses `req.permissions` if `requireAuth` already attached it, to avoid a duplicate lookup).
 *
 * @param {string} permissionKey - e.g. "booking:create".
 * @param {{
 *   companyIdFrom?: 'params' | 'query' | 'body',
 *   param?: string,
 *   requireCompanyId?: boolean,
 *   allowAnyCompany?: boolean,
 * }} [opts]
 *   When `requireCompanyId` is true, missing company context yields 403 (never any-company fallthrough).
 */
export function requirePermission(permissionKey, opts = {}) {
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        return next(new AppError(401, "Authentication required"));
      }

      const companyId = resolveCompanyId(req, opts);
      if (opts.requireCompanyId && !companyId) {
        return next(new AppError(403, "Forbidden"));
      }
      const ok = await permissionGranted(req, permissionKey, companyId, opts);
      if (!ok) {
        return next(new AppError(403, "Forbidden"));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Require ANY of the given `resource:action` permission keys (OR).
 * Same auth contract as `requirePermission` — mount after `requireAuth`.
 *
 * @param {string[]} permissionKeys
 * @param {{ companyIdFrom?: 'params' | 'query' | 'body', param?: string }} [opts]
 */
export function requireAnyPermission(permissionKeys, opts = {}) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys.filter(Boolean) : [];
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        return next(new AppError(401, "Authentication required"));
      }
      if (!keys.length) {
        return next(new AppError(403, "Forbidden"));
      }

      const companyId = resolveCompanyId(req, opts);
      if (opts.requireCompanyId && !companyId) {
        return next(new AppError(403, "Forbidden"));
      }
      for (const key of keys) {
        if (await permissionGranted(req, key, companyId, opts)) {
          return next();
        }
      }
      return next(new AppError(403, "Forbidden"));
    } catch (e) {
      next(e);
    }
  };
}

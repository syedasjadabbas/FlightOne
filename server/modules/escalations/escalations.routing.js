/**
 * Module 13 — Consultant queue routing (skill / language / VIP pools).
 *
 * Routes escalations to permission-backed consultant pools. Never invents
 * consultant availability, online status, assignment, response, or SLA.
 * Auto-assignment of a person is intentionally not performed.
 */
import prisma from "../../config/prisma.js";
import { userHasPermission } from "../../lib/permissions.service.js";
import { normalizeEscalationTrigger } from "./escalations.constants.js";

export const ROUTING_POOLS = Object.freeze({
  VIP: "VIP",
  MEDICAL: "MEDICAL",
  COMPLEX: "COMPLEX",
  GENERAL: "GENERAL",
});

export const ROUTING_STATUSES = Object.freeze({
  /** Eligible consultants exist for the pool — ticket waits for claim/assign. */
  POOL_ROUTED: "POOL_ROUTED",
  /** Pool requires specialists but none are configured — Ops must handle manually. */
  UNROUTED_NO_ELIGIBLE: "UNROUTED_NO_ELIGIBLE",
});

/** Base consultant queue permission (existing Module 13 key). */
export const PERM_ESCALATIONS_WRITE = "ops:escalations:write";
/** VIP specialist pool (additive). */
export const PERM_ESCALATIONS_VIP = "ops:escalations:vip";
/** Medical / SSR specialist pool (additive). */
export const PERM_ESCALATIONS_MEDICAL = "ops:escalations:medical";

/**
 * Parse optional language→permission map from env.
 * Example: ESCALATION_LANGUAGE_PERMISSION_MAP=en:ops:escalations:lang:en,ur:ops:escalations:lang:ur
 * Empty / unset → language never filters consultants (no invented language skills).
 */
export function getLanguagePermissionMap(env = process.env) {
  const raw = env.ESCALATION_LANGUAGE_PERMISSION_MAP || "";
  /** @type {Record<string, string>} */
  const map = {};
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;
    const lang = trimmed.slice(0, idx).trim().toLowerCase();
    const perm = trimmed.slice(idx + 1).trim();
    if (lang && perm) map[lang] = perm;
  }
  return map;
}

/**
 * Resolve target pool + required permissions from trigger / priority / language.
 * @param {{ trigger: string, priority?: number, preferredLanguage?: string|null }} args
 */
export function resolveRoutingTarget({
  trigger,
  priority = 0,
  preferredLanguage = null,
  env = process.env,
} = {}) {
  const normalized = normalizeEscalationTrigger(trigger);
  /** @type {string[]} */
  const requiredPermissions = [PERM_ESCALATIONS_WRITE];
  let pool = ROUTING_POOLS.GENERAL;
  let reason = "General consultant queue (ops:escalations:write)";

  if (normalized === "VIP_BOOKING" || normalized === "VIP") {
    pool = ROUTING_POOLS.VIP;
    requiredPermissions.push(PERM_ESCALATIONS_VIP);
    reason = "VIP booking / VIP customer → VIP consultant pool";
  } else if (
    normalized === "MEDICAL_ASSISTANCE" ||
    normalized === "MEDICAL" ||
    normalized === "SPECIAL_SERVICE_REQUEST" ||
    normalized === "SSR"
  ) {
    pool = ROUTING_POOLS.MEDICAL;
    requiredPermissions.push(PERM_ESCALATIONS_MEDICAL);
    reason = "Medical / special service → medical consultant pool";
  } else if (normalized === "COMPLEX_ITINERARY") {
    pool = ROUTING_POOLS.COMPLEX;
    reason = "Complex itinerary → general consultant pool (complexity flagged)";
  } else if (typeof priority === "number" && priority >= 3) {
    reason = `High priority (${priority}) → general consultant queue`;
  }

  const langMap = getLanguagePermissionMap(env);
  const lang =
    typeof preferredLanguage === "string" && preferredLanguage.trim()
      ? preferredLanguage.trim().toLowerCase().slice(0, 8)
      : null;
  let languagePermission = null;
  if (lang && langMap[lang]) {
    languagePermission = langMap[lang];
    requiredPermissions.push(languagePermission);
    reason = `${reason}; language filter ${lang}`;
  }

  return {
    pool,
    requiredPermissions: [...new Set(requiredPermissions)],
    preferredLanguage: lang,
    languagePermission,
    reason,
  };
}

/**
 * Count users who hold every required permission (global role assignments).
 * Does NOT claim anyone is available/online — only entitlement membership.
 * @param {string[]} requiredPermissions
 * @returns {Promise<{ count: number, consultantIds: string[] }>}
 */
export async function findEligibleConsultants(requiredPermissions) {
  const perms = [...new Set((requiredPermissions || []).filter(Boolean))];
  if (!perms.length) {
    return { count: 0, consultantIds: [] };
  }

  // Users who have ALL required keys via global (companyId null) role grants.
  // Excludes platform Super Admin accounts from being counted as active frontline queue specialists.
  const rows = await prisma.userRole.findMany({
    where: {
      companyId: null,
      role: {
        name: { notIn: ["Super Admin", "SuperAdmin", "super_admin"] },
      },
    },
    select: {
      userId: true,
      role: {
        select: {
          permissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  /** @type {Map<string, Set<string>>} */
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, new Set());
    const set = byUser.get(row.userId);
    for (const rp of row.role.permissions) {
      set.add(rp.permission.key);
    }
  }

  const consultantIds = [];
  for (const [userId, keys] of byUser) {
    if (perms.every((p) => keys.has(p))) consultantIds.push(userId);
  }

  return { count: consultantIds.length, consultantIds };
}

/**
 * Build durable routing record for snapshot + ticket columns.
 * @param {{ trigger: string, priority?: number, preferredLanguage?: string|null }} args
 */
export async function buildEscalationRouting(args) {
  const target = resolveRoutingTarget(args);
  const { count, consultantIds } = await findEligibleConsultants(target.requiredPermissions);

  const finalStatus =
    count > 0 ? ROUTING_STATUSES.POOL_ROUTED : ROUTING_STATUSES.UNROUTED_NO_ELIGIBLE;

  return {
    pool: target.pool,
    status: finalStatus,
    requiredPermissions: target.requiredPermissions,
    preferredLanguage: target.preferredLanguage,
    languagePermission: target.languagePermission,
    eligibleConsultantCount: count,
    // Internal only — strip before API via toPublicRouting.
    _eligibleConsultantIds: consultantIds,
    reason: target.reason,
    routedAt: new Date().toISOString(),
    availabilityClaimed: false,
    autoAssigned: false,
  };
}

/** Public routing fields safe for API responses (no consultant id list). */
export function toPublicRouting(routing) {
  if (!routing || typeof routing !== "object") return null;
  return {
    pool: routing.pool ?? null,
    status: routing.status ?? null,
    requiredPermissions: Array.isArray(routing.requiredPermissions)
      ? routing.requiredPermissions
      : [],
    preferredLanguage: routing.preferredLanguage ?? null,
    eligibleConsultantCount:
      typeof routing.eligibleConsultantCount === "number"
        ? routing.eligibleConsultantCount
        : null,
    reason: routing.reason ?? null,
    routedAt: routing.routedAt ?? null,
    availabilityClaimed: false,
    autoAssigned: false,
  };
}

/**
 * Whether a consultant may claim/be assigned given routing state.
 * POOL_ROUTED specialized pools require matching specialist perms.
 * UNROUTED_NO_ELIGIBLE allows any ops:escalations:write for manual Ops handling.
 */
export async function assertConsultantEligibleForTicket(consultantUserId, routing) {
  if (!consultantUserId) return { ok: false, code: "NO_CONSULTANT" };
  const writeOk = await userHasPermission(consultantUserId, PERM_ESCALATIONS_WRITE);
  if (!writeOk) {
    return { ok: false, code: "MISSING_WRITE", message: "ops:escalations:write required" };
  }

  const publicRouting = toPublicRouting(routing);
  if (!publicRouting) {
    return { ok: true, mode: "legacy_unrouted" };
  }

  if (publicRouting.status === ROUTING_STATUSES.UNROUTED_NO_ELIGIBLE) {
    // Manual Ops handling — write permission is enough.
    return { ok: true, mode: "manual_ops" };
  }

  const required = publicRouting.requiredPermissions || [];
  for (const key of required) {
    // eslint-disable-next-line no-await-in-loop
    const has = await userHasPermission(consultantUserId, key);
    if (!has) {
      return {
        ok: false,
        code: "POOL_MISMATCH",
        message: `Consultant lacks required pool permission: ${key}`,
        pool: publicRouting.pool,
      };
    }
  }
  return { ok: true, mode: "pool_routed" };
}

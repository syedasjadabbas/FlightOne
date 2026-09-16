import prisma from "../config/prisma.js";
import logger from "./logger.js";

/**
 * Keys that must never appear in audit metadata (case-insensitive match on key name).
 */
const FORBIDDEN_META_KEY =
  /^(password|passwd|pwd|token|refreshToken|accessToken|authorization|cookie|secret|apiKey|api_key|resetToken|rawToken|tokenHash|passwordHash|fo_refresh)$/i;

/**
 * Strip secrets from audit metadata. Never throws.
 * @param {unknown} metadata
 * @returns {object|undefined}
 */
export function sanitizeAuditMetadata(metadata) {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_META_KEY.test(key)) continue;
    if (typeof value === "string" && /bearer\s+[a-z0-9._-]+/i.test(value)) continue;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const nested = sanitizeAuditMetadata(value);
      if (nested && Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Write an immutable audit log entry. Never throws — a failed audit write must not
 * break the request it's auditing; log and swallow instead (mirrors crm-server).
 *
 * @param {object} params
 * @param {string|null} [params.userId] - actor; null for unauthenticated/system actions.
 * @param {string} params.action - e.g. "auth.login", "permission.role_assigned".
 * @param {string} params.resourceType - e.g. "User", "Role", "Booking".
 * @param {string|null} [params.resourceId]
 * @param {import('express').Request} [params.req] - used to capture ip/userAgent.
 * @param {object|null} [params.metadata] - freeform JSON payload (never raw secrets/PII).
 */
export async function writeAudit({
  userId,
  action,
  resourceType,
  resourceId,
  req,
  metadata,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resourceType,
        resourceId: resourceId ?? null,
        ip: req?.ip ?? req?.socket?.remoteAddress ?? null,
        userAgent: req?.get?.("user-agent") ?? null,
        metadata: sanitizeAuditMetadata(metadata) ?? undefined,
      },
    });
  } catch (e) {
    logger.error("audit write failed", {
      err: e.message,
      action,
      resourceType,
      resourceId,
    });
  }
}

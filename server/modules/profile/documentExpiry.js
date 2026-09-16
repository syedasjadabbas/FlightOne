/**
 * Module 02 — identity document expiry status + PRD lead-time helpers.
 * Lead times from PRD Module 02: 6 months / 1 month / 1 week before expiry.
 * Override via PROFILE_DOC_EXPIRY_LEAD_DAYS=180,30,7 (comma-separated days).
 */
import { AppError } from "../../lib/customError.js";

export const PRD_DEFAULT_EXPIRY_LEAD_DAYS = Object.freeze([180, 30, 7]);

export const PROFILE_DOC_NOTIFICATION_CHANNELS = Object.freeze([
  "APP",
  "EMAIL",
  "WHATSAPP",
]);

/** Parse lead-day list from env or fall back to PRD examples. */
export function getExpiryLeadDays() {
  const raw = process.env.PROFILE_DOC_EXPIRY_LEAD_DAYS?.trim();
  if (!raw) return [...PRD_DEFAULT_EXPIRY_LEAD_DAYS];
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return parsed.length ? [...new Set(parsed)].sort((a, b) => b - a) : [...PRD_DEFAULT_EXPIRY_LEAD_DAYS];
}

function startOfUtcDay(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Whole UTC days from `from` to `to` (can be negative if past).
 * @param {Date} to
 * @param {Date} [from]
 */
export function daysUntil(to, from = new Date()) {
  const a = startOfUtcDay(from instanceof Date ? from : new Date(from));
  const b = startOfUtcDay(to instanceof Date ? to : new Date(to));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Validate issue/expiry pairing. Throws AppError(400) for HTTP/domain paths.
 * @param {Date|null|undefined} issuedAt
 * @param {Date|null|undefined} expiresAt
 */
export function assertValidDocumentDates(issuedAt, expiresAt) {
  if (issuedAt != null && Number.isNaN(new Date(issuedAt).getTime())) {
    throw new AppError(400, "issuedAt is invalid");
  }
  if (expiresAt != null && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new AppError(400, "expiresAt is invalid");
  }
  if (issuedAt != null && expiresAt != null) {
    const issued = new Date(issuedAt).getTime();
    const expires = new Date(expiresAt).getTime();
    if (expires < issued) {
      throw new AppError(400, "expiresAt must be on or after issuedAt");
    }
  }
}

/**
 * Reliable expiry-status calculation (request-time and worker-shared).
 * @param {Date|string|null|undefined} expiresAt
 * @param {{ now?: Date, leadDays?: number[] }} [opts]
 * @returns {{
 *   state: 'unknown'|'valid'|'expiring_soon'|'expired',
 *   daysRemaining: number|null,
 *   matchedLeadDays: number|null,
 *   isExpired: boolean,
 * }}
 */
export function computeExpiryStatus(expiresAt, opts = {}) {
  if (expiresAt == null || expiresAt === "") {
    return {
      state: "unknown",
      daysRemaining: null,
      matchedLeadDays: null,
      isExpired: false,
    };
  }
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) {
    return {
      state: "unknown",
      daysRemaining: null,
      matchedLeadDays: null,
      isExpired: false,
    };
  }

  const now = opts.now ?? new Date();
  const leadDays = (opts.leadDays ?? getExpiryLeadDays()).slice().sort((a, b) => a - b);
  const daysRemaining = daysUntil(exp, now);

  if (daysRemaining < 0) {
    return {
      state: "expired",
      daysRemaining,
      matchedLeadDays: null,
      isExpired: true,
    };
  }

  // Smallest lead window that still covers daysRemaining (e.g. 5 days → 7).
  const matched =
    leadDays.find((d) => daysRemaining <= d) ?? null;

  if (matched != null) {
    return {
      state: "expiring_soon",
      daysRemaining,
      matchedLeadDays: matched,
      isExpired: false,
    };
  }

  return {
    state: "valid",
    daysRemaining,
    matchedLeadDays: null,
    isExpired: false,
  };
}

/**
 * Which lead-time buckets are due for notification at `now` (inclusive of the day).
 * A lead of N fires when daysRemaining === N (exact day), so the worker can
 * schedule once per lead without spam. Also fires if we missed the exact day
 * but are still inside that window and haven't notified yet (caller dedupes).
 *
 * @param {Date|string|null|undefined} expiresAt
 * @param {{ now?: Date, leadDays?: number[] }} [opts]
 * @returns {number[]} lead day values that should be enqueued
 */
export function dueExpiryLeadNotifications(expiresAt, opts = {}) {
  const status = computeExpiryStatus(expiresAt, opts);
  if (status.state === "unknown" || status.isExpired) return [];
  const leadDays = (opts.leadDays ?? getExpiryLeadDays()).slice().sort((a, b) => b - a);
  const remaining = status.daysRemaining;
  // Fire when we are at or past the lead threshold but not yet expired:
  // e.g. lead 30 fires for remaining in [0, 30]. Dedupe key per lead prevents duplicates.
  return leadDays.filter((lead) => remaining <= lead);
}

/** Dedupe key for NotificationOutbox @@unique([dedupeKey, channel]). */
export function expiryNotificationDedupeKey(documentId, leadDays) {
  return `profile-doc-expiry:${documentId}:lead:${leadDays}`;
}

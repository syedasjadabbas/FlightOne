/**
 * Module 15 — CUSTOMER_UPSERTED producer for CRM lead/customer sync.
 *
 * Emits OpsOutboxEvent rows only. Live CRM delivery is the existing outbox
 * worker + crm.adapter (SKIPPED_UNCONFIGURED when credentials absent).
 *
 * Never includes password hashes, tokens, vault bytes, payment data, or
 * free-form profile.metadata.
 */
import crypto from "node:crypto";
import prisma from "../../../../config/prisma.js";
import logger from "../../../../lib/logger.js";
import { enqueueOpsEvent } from "../../operations.service.js";

export const CUSTOMER_UPSERT_SOURCES = Object.freeze({
  REGISTER: "auth.register",
  PROFILE_UPDATE: "profile.update",
});

const MATERIAL_PROFILE_FIELDS = [
  "displayName",
  "phone",
  "nationality",
  "seatPref",
  "mealPref",
  "preferredAirlines",
  "preferredCabin",
  "maxLayoverMinutes",
];

/** Stable JSON for idempotency hashing (sorted keys, no undefined). */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

export function hashCustomerUpsertPayload(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex").slice(0, 32);
}

/**
 * Build CRM-safe payload from authoritative DB rows. Never accepts client body.
 */
export function buildCustomerUpsertPayload({ user, profile = null, companyIds = [], source }) {
  if (!user?.id) {
    throw new Error("user.id is required for CUSTOMER_UPSERTED payload");
  }
  const uniqueCompanies = [
    ...new Set(
      (Array.isArray(companyIds) ? companyIds : [])
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim()),
    ),
  ].sort();

  const stamp = profile?.updatedAt || user.updatedAt || new Date();
  const updatedAt =
    stamp instanceof Date
      ? stamp.toISOString()
      : new Date(stamp).toISOString();

  return {
    userId: user.id,
    email: user.email || null,
    name: user.name ?? null,
    displayName: profile?.displayName ?? null,
    phone: profile?.phone ?? null,
    nationality: profile?.nationality ?? null,
    preferredCabin: profile?.preferredCabin ?? null,
    seatPref: profile?.seatPref ?? null,
    mealPref: profile?.mealPref ?? null,
    preferredAirlines: Array.isArray(profile?.preferredAirlines)
      ? [...profile.preferredAirlines]
      : [],
    companyIds: uniqueCompanies,
    source: source || CUSTOMER_UPSERT_SOURCES.REGISTER,
    updatedAt,
  };
}

/** True when a profile PATCH changed CRM-relevant fields. */
export function isMaterialProfileChange(before, after, patch = {}) {
  if (!patch || typeof patch !== "object") return false;
  return MATERIAL_PROFILE_FIELDS.some((key) => {
    if (patch[key] === undefined) return false;
    return stableStringify(before?.[key] ?? null) !== stableStringify(after?.[key] ?? null);
  });
}

/**
 * Assert payload never carries forbidden secret-shaped keys (defense in depth).
 */
export function assertSafeCustomerUpsertPayload(payload) {
  const json = JSON.stringify(payload);
  const forbidden =
    /passwordHash|"password"|refreshToken|accessToken|tokenHash|paymentMethodToken|cardNumber|cvv|rawToken/i;
  if (forbidden.test(json)) {
    throw new Error("CUSTOMER_UPSERTED payload contained forbidden sensitive fields");
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "metadata")) {
    throw new Error("CUSTOMER_UPSERTED payload must not include free-form metadata");
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "passwordHash")) {
    throw new Error("CUSTOMER_UPSERTED payload must not include passwordHash");
  }
}

async function loadCustomerUpsertContext(userId) {
  const [user, profile, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, updatedAt: true },
    }),
    prisma.travellerProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        displayName: true,
        phone: true,
        nationality: true,
        seatPref: true,
        mealPref: true,
        preferredAirlines: true,
        preferredCabin: true,
        maxLayoverMinutes: true,
        updatedAt: true,
      },
    }),
    prisma.companyMembership.findMany({
      where: { userId },
      select: { companyId: true },
      orderBy: { companyId: "asc" },
    }),
  ]);
  if (!user) return null;
  return {
    user,
    profile,
    companyIds: memberships.map((m) => m.companyId),
  };
}

/**
 * Enqueue CUSTOMER_UPSERTED. Idempotent via content-addressed key per user+payload.
 *
 * @param {{ userId: string, source: string, idempotencySuffix?: string }} args
 */
export async function enqueueCustomerUpserted({ userId, source, idempotencySuffix } = {}) {
  if (!userId) throw new Error("userId is required");
  if (!source) throw new Error("source is required");

  const ctx = await loadCustomerUpsertContext(userId);
  if (!ctx) {
    logger.warn("ops.customer_upserted.skip — user not found", { userId });
    return null;
  }

  const payload = buildCustomerUpsertPayload({
    user: ctx.user,
    profile: ctx.profile,
    companyIds: ctx.companyIds,
    source,
  });
  assertSafeCustomerUpsertPayload(payload);

  const contentHash = hashCustomerUpsertPayload({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    displayName: payload.displayName,
    phone: payload.phone,
    nationality: payload.nationality,
    preferredCabin: payload.preferredCabin,
    seatPref: payload.seatPref,
    mealPref: payload.mealPref,
    preferredAirlines: payload.preferredAirlines,
    companyIds: payload.companyIds,
    source: payload.source,
  });

  // Registration: one create-key per user (retries collapse).
  // Profile updates: content hash so identical retries dedupe; new material state → new event.
  const idempotencyKey =
    idempotencySuffix ||
    (source === CUSTOMER_UPSERT_SOURCES.REGISTER
      ? `ops:customer:upserted:register:${userId}`
      : `ops:customer:upserted:profile:${userId}:${contentHash}`);

  return enqueueOpsEvent({
    type: "CUSTOMER_UPSERTED",
    aggregateType: "User",
    aggregateId: userId,
    idempotencyKey,
    payload,
  });
}

/** Never break auth/profile flows if outbox write fails. */
export async function enqueueCustomerUpsertedSafe(args) {
  try {
    return await enqueueCustomerUpserted(args);
  } catch (e) {
    logger.warn("ops.customer_upserted.enqueue_failed", {
      userId: args?.userId || null,
      source: args?.source || null,
      message: e?.message || String(e),
    });
    return null;
  }
}

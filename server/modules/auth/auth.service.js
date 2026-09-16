import { randomInt } from "node:crypto";
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { parseDurationToMs } from "../../lib/expires.js";
import { signAccessToken } from "../../lib/jwt.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { drainNotificationOutbox } from "../../lib/notifications/drain.js";
import logger from "../../lib/logger.js";
import {
  captureSessionClientMeta,
  summarizeUserAgent,
} from "./sessionMeta.js";

const REFRESH_DEFAULT_MS = 7 * 86400000;
const RESET_DEFAULT_MS = 10 * 60 * 1000; // 10 minutes for OTP

function refreshExpiresAt() {
  return new Date(
    Date.now() +
      parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN, REFRESH_DEFAULT_MS),
  );
}

function resetExpiresAt() {
  return new Date(
    Date.now() +
      parseDurationToMs(process.env.PASSWORD_RESET_EXPIRES_IN, RESET_DEFAULT_MS),
  );
}

function publicAppBaseUrl(env = process.env) {
  const raw =
    env.PUBLIC_APP_URL?.trim() ||
    env.FRONTEND_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function emailWebhookConfigured(env = process.env) {
  return Boolean(env.NOTIFY_EMAIL_WEBHOOK_URL?.trim());
}

/** Enumeration-safe delivery status — reflects provider config only, never account existence. */
export function passwordResetEmailDeliveryStatus(env = process.env) {
  return emailWebhookConfigured(env) ? "QUEUED" : "UNCONFIGURED";
}

function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/** Public session DTO — never includes tokenHash or raw refresh tokens. */
export function toPublicSession(row, { currentSessionId = null } = {}) {
  return {
    id: row.id,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    lastUsedAt: row.lastUsedAt?.toISOString?.() ?? row.lastUsedAt,
    expiresAt: row.expiresAt?.toISOString?.() ?? row.expiresAt,
    userAgent: row.userAgent ?? null,
    deviceLabel: summarizeUserAgent(row.userAgent),
    ip: row.ip ?? null,
    current: Boolean(currentSessionId && row.id === currentSessionId),
  };
}

function resolveCurrentSessionId({ currentSessionId } = {}) {
  if (typeof currentSessionId === "string" && currentSessionId.trim()) {
    return currentSessionId.trim();
  }
  return null;
}

async function resolveCurrentSessionIdFromRefresh(userId, refreshToken) {
  if (typeof refreshToken !== "string" || !refreshToken.trim()) return null;
  const row = await prisma.refreshToken.findFirst({
    where: {
      userId,
      tokenHash: sha256Hex(refreshToken.trim()),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function issueSession(user, { req, familyId } = {}) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
  });
  const refreshToken = randomToken();
  const now = new Date();
  const meta = captureSessionClientMeta(req);
  const sessionFamilyId =
    typeof familyId === "string" && familyId.trim() ? familyId.trim() : randomToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId: sessionFamilyId,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: refreshExpiresAt(),
      lastUsedAt: now,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
    select: { id: true, familyId: true },
  });

  await writeAudit({
    userId: user.id,
    action: "auth.session.create",
    resourceType: "RefreshToken",
    resourceId: row.id,
    req,
    metadata: {
      userAgent: meta.userAgent,
      ip: meta.ip,
      familyId: row.familyId,
    },
  }).catch(() => {});

  return {
    accessToken,
    refreshToken,
    sessionId: row.id,
    user: toAuthUser(user),
  };
}

async function revokeFamilyTokens(tx, familyId, { reason, exceptId } = {}) {
  if (!familyId) return { count: 0 };
  const result = await tx.refreshToken.updateMany({
    where: {
      familyId,
      revokedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason || "family_revoke",
    },
  });
  return { count: result.count };
}

export async function revokeAllRefreshTokensForUser(userId) {
  if (!userId) return { count: 0 };
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: "password_reset_or_global_revoke" },
  });
  return { count: result.count };
}

export async function issueEmailVerificationOtp(user, { env = process.env } = {}) {
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = randomInt(100000, 1000000).toString();
  const tokenHash = sha256Hex(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      attempts: 0,
      expiresAt,
    },
  });

  await enqueueNotificationOutbox([
    {
      userId: user.id,
      channel: "EMAIL",
      dedupeKey: `email-verification:${user.id}:${Date.now()}`,
      title: "Verify your FlightOne email address",
      body: `Your 6-digit email verification code is: ${otp}. It expires in 10 minutes.`,
      payload: {
        module: "auth",
        kind: "email_verification_otp",
        otp,
        expiresAt: expiresAt.toISOString(),
      },
    },
  ]).catch((e) => {
    logger.warn("auth.email_verification.enqueue_failed", {
      userId: user.id,
      err: e?.message,
    });
  });

  drainNotificationOutbox({ limit: 5 }).catch(() => {});

  return {
    accepted: true,
    requiresVerification: true,
    email: user.email,
    userId: user.id,
    ...(env.NODE_ENV === "test" && env.EMAIL_VERIFICATION_RETURN_TOKEN === "true"
      ? { _testToken: otp }
      : {}),
  };
}

export async function registerUser({ email, password, name }, { req, env = process.env } = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (exists) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name ?? null,
      passwordHash,
      passwordChangedAt: new Date(),
    },
    select: { id: true, email: true, name: true },
  });

  // Module 15 — CRM lead/customer sync (outbox; SKIPPED_UNCONFIGURED when CRM unset).
  const { enqueueCustomerUpsertedSafe, CUSTOMER_UPSERT_SOURCES } = await import(
    "../operations/integrations/crm/customerUpsert.producer.js"
  );
  await enqueueCustomerUpsertedSafe({
    userId: user.id,
    source: CUSTOMER_UPSERT_SOURCES.REGISTER,
  });

  return issueEmailVerificationOtp(user, { env });
}

export async function verifyEmail({ email, code }, { req } = {}) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const rawCode = typeof code === "string" ? code.trim() : "";

  if (!normalizedEmail || !rawCode || rawCode.length !== 6) {
    throw new AppError(400, "Invalid or expired verification code");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });

  if (!user) {
    throw new AppError(400, "Invalid or expired verification code");
  }

  const activeToken = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!activeToken || activeToken.expiresAt < new Date()) {
    throw new AppError(400, "Invalid or expired verification code");
  }

  if (activeToken.attempts >= 4) {
    await prisma.emailVerificationToken.update({
      where: { id: activeToken.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError(429, "Too many failed verification attempts. Please request a new verification code.");
  }

  const tokenHash = sha256Hex(rawCode);
  if (activeToken.tokenHash !== tokenHash) {
    await prisma.emailVerificationToken.update({
      where: { id: activeToken.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, "Invalid or expired verification code");
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  });

  await writeAudit({
    userId: user.id,
    action: "auth.email.verify",
    resourceType: "User",
    resourceId: user.id,
    req,
    metadata: { outcome: "success" },
  }).catch(() => {});

  return issueSession(user, { req });
}

export async function resendVerificationCode({ email }, { req, env = process.env } = {}) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const publicResponse = {
    accepted: true,
    message: "If an unverified account exists for that email, a new verification code has been sent.",
  };

  if (!normalizedEmail) return publicResponse;

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });

  if (!user || user.emailVerifiedAt) {
    return publicResponse;
  }

  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    const ageMs = Date.now() - new Date(recentToken.createdAt).getTime();
    if (ageMs < 60_000) {
      throw new AppError(429, "Please wait before requesting another verification code.");
    }
  }

  const result = await issueEmailVerificationOtp(user, { env });

  await writeAudit({
    userId: user.id,
    action: "auth.email.resend",
    resourceType: "User",
    resourceId: user.id,
    req,
    metadata: { outcome: "token_reissued" },
  }).catch(() => {});

  return {
    ...publicResponse,
    ...(result._testToken ? { _testToken: result._testToken } : {}),
  };
}

/** One-time when database has zero users. */
export async function bootstrapFirstUser({ email, password, name }, { req } = {}) {
  const count = await prisma.user.count();
  if (count > 0) {
    throw new AppError(403, "Bootstrap already completed");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name ?? null,
      passwordHash,
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, name: true },
  });
  return issueSession(user, { req });
}

export async function loginUser({ email, password }, { req } = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerifiedAt: true,
    },
  });

  const passwordOk =
    Boolean(user?.passwordHash) &&
    (await comparePassword(password, user.passwordHash));

  if (!passwordOk) {
    // Enumeration-safe API error. Audit metadata is identical for known/unknown;
    // userId is set only when the account exists (ops correlation), never the password.
    await writeAudit({
      userId: user?.id ?? null,
      action: "auth.login",
      resourceType: "User",
      resourceId: user?.id ?? null,
      req,
      metadata: {
        outcome: "failure",
        reason: "invalid_credentials",
      },
    });
    throw new AppError(401, "Invalid credentials");
  }

  if (!user.emailVerifiedAt) {
    await writeAudit({
      userId: user.id,
      action: "auth.login",
      resourceType: "User",
      resourceId: user.id,
      req,
      metadata: {
        outcome: "failure",
        reason: "email_not_verified",
      },
    });
    throw new AppError(403, "Email address not verified. Please verify your email first.", {
      requiresVerification: true,
      email: user.email,
    });
  }

  await writeAudit({
    userId: user.id,
    action: "auth.login",
    resourceType: "User",
    resourceId: user.id,
    req,
    metadata: { outcome: "success" },
  });

  // Distinct from auth.login: issues refresh-token session (auth.session.create).
  return issueSession(user, { req });
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new AppError(404, "Not found");
  return toAuthUser(user);
}

/**
 * Rotate refresh token. Detects reuse of an already-rotated/revoked token and
 * revokes the entire session family. Concurrent double-refresh of the same
 * still-valid token: only one wins the atomic revoke; the loser gets 401
 * without family wipe when the revoke was a fresh rotate (race grace).
 */
export async function refreshSession({ refreshToken }, { req } = {}) {
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  const tokenHash = sha256Hex(refreshToken.trim());
  const graceRaw = Number(process.env.REFRESH_ROTATE_GRACE_MS);
  const RECENT_ROTATE_GRACE_MS =
    Number.isFinite(graceRaw) && graceRaw >= 0 ? graceRaw : 15_000;

  const outcome = await prisma.$transaction(async (tx) => {
    const row = await tx.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!row) {
      return { type: "reject" };
    }

    if (row.revokedAt) {
      const ageMs = Date.now() - new Date(row.revokedAt).getTime();
      const recentRotate =
        row.revokeReason === "refresh_rotate" &&
        Number.isFinite(ageMs) &&
        ageMs >= 0 &&
        ageMs < RECENT_ROTATE_GRACE_MS;

      if (!recentRotate) {
        await revokeFamilyTokens(tx, row.familyId, { reason: "reuse_detected" });
        return {
          type: "reuse",
          userId: row.user.id,
          tokenId: row.id,
          familyId: row.familyId,
        };
      }
      return { type: "reject" };
    }

    if (row.expiresAt < new Date()) {
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), revokeReason: "expired" },
      });
      return { type: "reject" };
    }

    const claimed = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "refresh_rotate" },
    });

    if (claimed.count !== 1) {
      return { type: "reject" };
    }

    const accessToken = signAccessToken({
      sub: row.user.id,
      email: row.user.email,
    });
    const nextRefresh = randomToken();
    const now = new Date();
    const meta = captureSessionClientMeta(req);
    const next = await tx.refreshToken.create({
      data: {
        userId: row.user.id,
        familyId: row.familyId,
        tokenHash: sha256Hex(nextRefresh),
        expiresAt: refreshExpiresAt(),
        lastUsedAt: now,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
      select: { id: true, familyId: true },
    });

    return {
      type: "ok",
      session: {
        accessToken,
        refreshToken: nextRefresh,
        sessionId: next.id,
        user: toAuthUser(row.user),
      },
      audit: {
        userId: row.user.id,
        rotatedFrom: row.id,
        nextId: next.id,
        familyId: next.familyId,
        meta,
      },
    };
  });

  if (outcome.type === "ok") {
    await writeAudit({
      userId: outcome.audit.userId,
      action: "auth.session.revoke",
      resourceType: "RefreshToken",
      resourceId: outcome.audit.rotatedFrom,
      req,
      metadata: { reason: "refresh_rotate", familyId: outcome.audit.familyId },
    }).catch(() => {});
    await writeAudit({
      userId: outcome.audit.userId,
      action: "auth.session.create",
      resourceType: "RefreshToken",
      resourceId: outcome.audit.nextId,
      req,
      metadata: {
        userAgent: outcome.audit.meta.userAgent,
        ip: outcome.audit.meta.ip,
        familyId: outcome.audit.familyId,
        rotatedFrom: outcome.audit.rotatedFrom,
      },
    }).catch(() => {});
    return outcome.session;
  }

  if (outcome.type === "reuse") {
    await writeAudit({
      userId: outcome.userId,
      action: "auth.session.revoke",
      resourceType: "RefreshToken",
      resourceId: outcome.tokenId,
      req,
      metadata: {
        reason: "refresh_reuse_detected",
        familyId: outcome.familyId,
      },
    }).catch(() => {});
  }

  throw new AppError(401, "Invalid or expired refresh token");
}

export async function logoutUser({ refreshToken } = {}, { req } = {}) {
  if (!refreshToken) return;
  const tokenHash = sha256Hex(refreshToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    select: { id: true, userId: true, familyId: true, revokedAt: true },
  });
  if (!existing) return;

  await prisma.refreshToken.updateMany({
    where: { familyId: existing.familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: "logout" },
  });

  await writeAudit({
    userId: existing.userId,
    action: "auth.session.revoke",
    resourceType: "RefreshToken",
    resourceId: existing.id,
    req,
    metadata: { reason: "logout", familyId: existing.familyId },
  }).catch(() => {});
}

/**
 * List active sessions for the authenticated user only.
 * currentSessionId / refreshToken only used to mark `current` — never returned.
 */
export async function listSessions(
  userId,
  { currentSessionId, refreshToken } = {},
) {
  if (!userId) throw new AppError(401, "Authentication required");

  let currentId = resolveCurrentSessionId({ currentSessionId });
  if (!currentId) {
    currentId = await resolveCurrentSessionIdFromRefresh(userId, refreshToken);
  }

  const now = new Date();
  const rows = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      userAgent: true,
      ip: true,
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    sessions: rows.map((row) =>
      toPublicSession(row, { currentSessionId: currentId }),
    ),
  };
}

/**
 * Revoke a single session owned by the authenticated user (IDOR-safe).
 */
export async function revokeSession(userId, sessionId, { req } = {}) {
  if (!userId) throw new AppError(401, "Authentication required");
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!id) throw new AppError(400, "Session id is required");

  const row = await prisma.refreshToken.findFirst({
    where: { id, userId },
    select: { id: true, familyId: true, revokedAt: true },
  });
  // Same response for missing vs other-user — no cross-user existence leak.
  if (!row) {
    throw new AppError(404, "Session not found");
  }

  await prisma.refreshToken.updateMany({
    where: { familyId: row.familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: "user_revoke" },
  });

  await writeAudit({
    userId,
    action: "auth.session.revoke",
    resourceType: "RefreshToken",
    resourceId: row.id,
    req,
    metadata: { reason: "user_revoke", familyId: row.familyId },
  }).catch(() => {});

  return { ok: true, revokedSessionId: row.id };
}

/**
 * Revoke all other active sessions, preserving the current one.
 * Authority: authenticated userId + ownership of current session id / refresh token.
 */
export async function revokeOtherSessions(
  userId,
  { currentSessionId, refreshToken } = {},
  { req } = {},
) {
  if (!userId) throw new AppError(401, "Authentication required");

  let keepId = resolveCurrentSessionId({ currentSessionId });
  if (!keepId) {
    keepId = await resolveCurrentSessionIdFromRefresh(userId, refreshToken);
  }
  if (!keepId) {
    throw new AppError(400, "Current session is required to preserve");
  }

  const keep = await prisma.refreshToken.findFirst({
    where: {
      id: keepId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!keep) {
    throw new AppError(404, "Current session not found");
  }

  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      id: { not: keep.id },
    },
    data: { revokedAt: new Date(), revokeReason: "revoke_others" },
  });

  await writeAudit({
    userId,
    action: "auth.session.revoke_others",
    resourceType: "User",
    resourceId: userId,
    req,
    metadata: {
      preservedSessionId: keep.id,
      revokedCount: result.count,
    },
  }).catch(() => {});

  return {
    ok: true,
    preservedSessionId: keep.id,
    revokedCount: result.count,
  };
}

/**
 * Request a password reset. Always returns the same public shape (no account enumeration).
 * emailDelivery reflects provider configuration only — never whether the account exists.
 */
export async function requestPasswordReset({ email }, { req, env = process.env } = {}) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const publicMessage =
    "If an account exists for that email, password reset instructions will be sent when email delivery is available.";
  const emailDelivery = passwordResetEmailDeliveryStatus(env);

  const safeResponse = {
    accepted: true,
    emailDelivery,
    message: publicMessage,
  };

  if (!normalizedEmail) {
    return safeResponse;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    await writeAudit({
      userId: null,
      action: "auth.password_reset.request",
      resourceType: "User",
      resourceId: null,
      req,
      metadata: { outcome: "no_op", emailDelivery },
    }).catch(() => {});
    return safeResponse;
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = randomInt(100000, 1000000).toString();
  const tokenHash = sha256Hex(otp);
  const expiresAt = resetExpiresAt();

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  if (emailDelivery === "QUEUED") {
    const hourBucket = new Date().toISOString().slice(0, 13);
    await enqueueNotificationOutbox([
      {
        userId: user.id,
        channel: "EMAIL",
        dedupeKey: `password-reset:${user.id}:${hourBucket}`,
        title: "Your FlightOne Password Reset Code",
        body: `Your 6-digit password verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
        payload: {
          module: "auth",
          kind: "password_reset_otp",
          otp,
          expiresAt: expiresAt.toISOString(),
        },
      },
    ]).catch((e) => {
      logger.warn("auth.password_reset.enqueue_failed", {
        userId: user.id,
        err: e?.message,
      });
    });

    drainNotificationOutbox({ limit: 5 }).catch(() => {});
  }

  await writeAudit({
    userId: user.id,
    action: "auth.password_reset.request",
    resourceType: "User",
    resourceId: user.id,
    req,
    metadata: { outcome: "token_issued", emailDelivery },
  }).catch(() => {});

  if (env.NODE_ENV === "test" && env.PASSWORD_RESET_RETURN_TOKEN === "true") {
    return { ...safeResponse, _testToken: otp };
  }

  return safeResponse;
}

/**
 * Complete password reset with single-use 6-digit OTP or token. Authority is token hash.
 */
export async function resetPasswordWithToken(
  { email, token, password },
  { req, env = process.env } = {},
) {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) {
    throw new AppError(400, "Verification code is required");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  let targetUserId = null;
  if (normalizedEmail) {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (user) targetUserId = user.id;
  }

  const tokenHash = sha256Hex(raw);
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      ...(targetUserId ? { userId: targetUserId } : {}),
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    throw new AppError(400, "Invalid or expired verification code");
  }

  const passwordHash = await hashPassword(password);
  const changedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: changedAt },
    });
    if (consumed.count !== 1) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    await tx.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        passwordChangedAt: changedAt,
        emailVerifiedAt: changedAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: changedAt },
    });

    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, consumedAt: null, id: { not: row.id } },
      data: { consumedAt: changedAt },
    });
  });

  await writeAudit({
    userId: row.userId,
    action: "auth.password_reset.complete",
    resourceType: "User",
    resourceId: row.userId,
    req,
    metadata: {
      refreshTokensRevoked: true,
      passwordChangedAt: changedAt.toISOString(),
    },
  }).catch(() => {});

  return {
    ok: true,
    message: "Password updated. Please log in with your new password.",
    sessionsRevoked: true,
  };
}

/**
 * Reject access JWTs issued before the user's last password change.
 * Refresh tokens are revoked separately on reset.
 */
export async function assertAccessTokenStillValid(userId, jwtPayload) {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });
  if (!user?.passwordChangedAt) return;
  const iatSec = Number(jwtPayload?.iat);
  if (!Number.isFinite(iatSec)) {
    throw new AppError(401, "Invalid or expired token");
  }
  const changedSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
  if (iatSec < changedSec) {
    throw new AppError(401, "Session invalidated — please log in again");
  }
}

/**
 * Module 10 — Rewards & Referrals.
 * Ledger-based balances; configurable policy; corporate programmes;
 * checkout credit application; referral fraud guards; tier progression.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import {
  computeTierFromLifetime,
  creditMinorFromPoints,
  getRewardsPolicy,
  pointsFromBookingAmount,
  tierProgress,
} from "./rewards.policy.js";

const MAX_PAGE_SIZE = 100;
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 8;

const ACCOUNT_SELECT = {
  id: true,
  userId: true,
  referralCode: true,
  referredByUserId: true,
  tier: true,
  createdAt: true,
  updatedAt: true,
};

const LEDGER_SELECT = {
  id: true,
  accountId: true,
  type: true,
  points: true,
  bookingId: true,
  idempotencyKey: true,
  note: true,
  metadata: true,
  expiresAt: true,
  createdAt: true,
};

export { computeTierFromLifetime as computeTier, getRewardsPolicy, tierProgress };

function generateReferralCode() {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

function assertNonNegativeIntPoints(value, label = "points") {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new AppError(400, `${label} must be an integer (no floats)`);
  }
  if (value < 0) throw new AppError(400, `${label} must not be negative`);
  return value;
}

async function notifyReward(userId, { dedupeKey, title, body, payload }) {
  const channels = getRewardsPolicy().notificationChannels;
  await enqueueNotificationOutbox(
    channels.map((channel) => ({
      userId,
      channel,
      dedupeKey,
      title,
      body,
      payload: { module: "rewards", ...payload },
    })),
  );
}

export async function ensureAccount(userId) {
  if (!userId) throw new AppError(400, "userId is required");
  const existing = await prisma.rewardAccount.findUnique({
    where: { userId },
    select: ACCOUNT_SELECT,
  });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.rewardAccount.create({
        data: { userId, referralCode: generateReferralCode() },
        select: ACCOUNT_SELECT,
      });
    } catch (e) {
      if (e.code === "P2002") {
        const raceWinner = await prisma.rewardAccount.findUnique({
          where: { userId },
          select: ACCOUNT_SELECT,
        });
        if (raceWinner) return raceWinner;
        continue;
      }
      throw e;
    }
  }
  throw new AppError(500, "Failed to create reward account");
}

async function sumPoints(accountId, where = {}) {
  const agg = await prisma.rewardLedgerEntry.aggregate({
    where: { accountId, ...where },
    _sum: { points: true },
  });
  return agg._sum.points || 0;
}

async function recomputeTier(accountId) {
  const lifetimeEarned = await sumPoints(accountId, { type: "EARN" });
  const tier = computeTierFromLifetime(lifetimeEarned);
  await prisma.rewardAccount.update({ where: { id: accountId }, data: { tier } });
  return { tier, lifetimeEarned };
}

export async function getBalance(userId) {
  const account = await ensureAccount(userId);
  const policy = getRewardsPolicy();
  const [balance, lifetimeEarned] = await Promise.all([
    sumPoints(account.id),
    sumPoints(account.id, { type: "EARN" }),
  ]);
  const progress = tierProgress(lifetimeEarned, policy);
  if (progress.tier !== account.tier) {
    await prisma.rewardAccount.update({
      where: { id: account.id },
      data: { tier: progress.tier },
    });
  }
  return {
    balance,
    tier: progress.tier,
    referralCode: account.referralCode,
    lifetimeEarned,
    progress,
    policy: {
      earnPointsPerHundredMinor: policy.earnPointsPerHundredMinor,
      referralBonusPoints: policy.referralBonusPoints,
      pointValueMinor: policy.pointValueMinor,
      creditExpiryDays: policy.creditExpiryDays,
    },
  };
}

export async function listLedger(user, permissions, { userId, page, pageSize } = {}) {
  let targetUserId = user.id;
  if (userId && userId !== user.id) {
    if (!hasPermissionEff(permissions, "rewards:read")) {
      throw new AppError(403, "rewards:read permission required to view another user's ledger");
    }
    targetUserId = userId;
  }

  const account = await ensureAccount(targetUserId);
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const [items, total] = await Promise.all([
    prisma.rewardLedgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: LEDGER_SELECT,
    }),
    prisma.rewardLedgerEntry.count({ where: { accountId: account.id } }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function listMyReferrals(userId) {
  await ensureAccount(userId);
  const rows = await prisma.referralAttribution.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      referredUserId: true,
      signupAt: true,
      firstBookingId: true,
      rewardedAt: true,
      createdAt: true,
    },
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      status: r.rewardedAt ? "REWARDED" : "PENDING_QUALIFYING_BOOKING",
      signupAt: r.signupAt,
      firstBookingId: r.firstBookingId,
      rewardedAt: r.rewardedAt,
      createdAt: r.createdAt,
    })),
  };
}

async function earnCorporateForBooking({ companyId, bookingId, amountMinor }) {
  if (!companyId || !bookingId) return null;
  const program = await prisma.corporateRewardProgram.findUnique({
    where: { companyId },
  });
  if (!program?.isActive || program.companyEarnPointsPerHundredMinor <= 0) return null;

  const existing = await prisma.corporateRewardLedgerEntry.findFirst({
    where: { bookingId, type: "EARN" },
  });
  if (existing) return existing;

  const points = Math.floor((amountMinor / 100) * program.companyEarnPointsPerHundredMinor);
  if (points <= 0) return null;

  try {
    return await prisma.corporateRewardLedgerEntry.create({
      data: {
        programId: program.id,
        companyId,
        type: "EARN",
        points,
        bookingId,
        note: `Company earn for booking ${bookingId}`,
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      return prisma.corporateRewardLedgerEntry.findFirst({
        where: { bookingId, type: "EARN" },
      });
    }
    throw e;
  }
}

/**
 * Ticketed-booking earn. Idempotent per bookingId. Validates booking status.
 */
export async function earnForBooking({ bookingId, userId, amountMinor }) {
  if (!bookingId || typeof bookingId !== "string") {
    throw new AppError(400, "bookingId is required");
  }
  if (!userId || typeof userId !== "string") {
    throw new AppError(400, "userId is required");
  }
  assertNonNegativeIntPoints(amountMinor, "amountMinor");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, status: true, amountMinor: true, metadata: true },
  });
  if (!booking || booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }
  if (!["TICKETED", "ACTIVE", "COMPLETED"].includes(booking.status)) {
    throw new AppError(409, `Booking status ${booking.status} is not eligible for rewards`);
  }

  const policy = getRewardsPolicy();
  const companyId =
    booking.metadata && typeof booking.metadata === "object"
      ? booking.metadata.companyId || null
      : null;

  let personalEarnEnabled = true;
  if (companyId) {
    const program = await prisma.corporateRewardProgram.findUnique({
      where: { companyId },
    });
    if (program && program.personalEarnEnabled === false) {
      personalEarnEnabled = false;
    }
    await earnCorporateForBooking({
      companyId,
      bookingId,
      amountMinor: booking.amountMinor ?? amountMinor,
    });
  }

  if (!personalEarnEnabled) {
    return null;
  }

  const account = await ensureAccount(userId);
  const existingEarn = await prisma.rewardLedgerEntry.findFirst({
    where: { bookingId, type: "EARN" },
    select: LEDGER_SELECT,
  });
  if (existingEarn) return existingEarn;

  const points = pointsFromBookingAmount(booking.amountMinor ?? amountMinor, policy);
  if (points <= 0) return null;

  const expiresAt = new Date(
    Date.now() + policy.creditExpiryDays * 86_400_000,
  );

  let earnEntry;
  try {
    earnEntry = await prisma.$transaction(async (tx) => {
      const priorEarnCount = await tx.rewardLedgerEntry.count({
        where: { accountId: account.id, type: "EARN" },
      });

      const created = await tx.rewardLedgerEntry.create({
        data: {
          accountId: account.id,
          type: "EARN",
          points,
          bookingId,
          note: `Earned for booking ${bookingId}`,
          expiresAt,
          metadata: {
            amountMinor: booking.amountMinor,
            earnPointsPerHundredMinor: policy.earnPointsPerHundredMinor,
          },
        },
        select: LEDGER_SELECT,
      });

      if (priorEarnCount === 0 && account.referredByUserId) {
        const attribution = await tx.referralAttribution.findFirst({
          where: { referredUserId: userId, rewardedAt: null },
        });
        if (attribution) {
          const referrerAccount = await tx.rewardAccount.findUnique({
            where: { userId: attribution.referrerUserId },
            select: { id: true, userId: true },
          });
          if (referrerAccount) {
            await tx.rewardLedgerEntry.create({
              data: {
                accountId: referrerAccount.id,
                type: "REFERRAL_BONUS",
                points: policy.referralBonusPoints,
                bookingId,
                note: `Referral bonus for referring user ${userId}`,
                expiresAt,
                metadata: { referredUserId: userId },
              },
            });
            await tx.referralAttribution.update({
              where: { id: attribution.id },
              data: { firstBookingId: bookingId, rewardedAt: new Date() },
            });
          }
        }
      }

      return created;
    });
  } catch (e) {
    if (e.code === "P2002") {
      return prisma.rewardLedgerEntry.findFirst({
        where: { bookingId, type: "EARN" },
        select: LEDGER_SELECT,
      });
    }
    throw e;
  }

  await recomputeTier(account.id);
  await writeAudit({
    userId,
    action: "rewards.earn",
    resourceType: "Booking",
    resourceId: bookingId,
    metadata: { points, ledgerId: earnEntry.id },
  });
  await notifyReward(userId, {
    dedupeKey: `reward-earn:${bookingId}`,
    title: "Rewards earned",
    body: `You earned ${points} reward point(s) from a completed booking.`,
    payload: { kind: "earn", bookingId, points },
  });

  if (account.referredByUserId) {
    const attribution = await prisma.referralAttribution.findFirst({
      where: { referredUserId: userId, firstBookingId: bookingId, rewardedAt: { not: null } },
      select: { referrerUserId: true },
    });
    if (attribution?.referrerUserId) {
      const referrerAccount = await prisma.rewardAccount.findUnique({
        where: { userId: attribution.referrerUserId },
        select: { id: true },
      });
      if (referrerAccount) await recomputeTier(referrerAccount.id);
      await notifyReward(attribution.referrerUserId, {
        dedupeKey: `reward-referral:${bookingId}`,
        title: "Referral reward",
        body: `You earned ${getRewardsPolicy().referralBonusPoints} point(s) for a successful referral.`,
        payload: { kind: "referral_bonus", bookingId },
      });
    }
  }

  return earnEntry;
}

export async function reverseRewardsForBooking(bookingId) {
  if (!bookingId || typeof bookingId !== "string") {
    throw new AppError(400, "bookingId is required");
  }

  const earnEntry = await prisma.rewardLedgerEntry.findFirst({
    where: { bookingId, type: "EARN" },
    select: LEDGER_SELECT,
  });

  // Reverse company earn if any.
  const corpEarn = await prisma.corporateRewardLedgerEntry.findFirst({
    where: { bookingId, type: "EARN" },
  });
  if (corpEarn) {
    const existingCorpRev = await prisma.corporateRewardLedgerEntry.findFirst({
      where: { bookingId, type: "REVERSE" },
    });
    if (!existingCorpRev) {
      await prisma.corporateRewardLedgerEntry.create({
        data: {
          programId: corpEarn.programId,
          companyId: corpEarn.companyId,
          type: "REVERSE",
          points: -corpEarn.points,
          bookingId,
          note: `Reversal of company earn for booking ${bookingId}`,
        },
      }).catch(() => {});
    }
  }

  // Restore checkout redemption if any for this booking.
  // Use bookingId=null + idempotencyKey so we don't collide with earn REVERSE
  // on @@unique([bookingId, type]).
  const redeemEntry = await prisma.rewardLedgerEntry.findFirst({
    where: { bookingId, type: "REDEEM" },
    select: LEDGER_SELECT,
  });
  if (redeemEntry) {
    const existingRedeemRev = await prisma.rewardLedgerEntry.findUnique({
      where: { idempotencyKey: `redeem-reverse:${bookingId}` },
      select: { id: true },
    });
    if (!existingRedeemRev) {
      await prisma.rewardLedgerEntry
        .create({
          data: {
            accountId: redeemEntry.accountId,
            type: "REVERSE",
            points: -redeemEntry.points, // redeem was negative; reverse restores
            bookingId: null,
            idempotencyKey: `redeem-reverse:${bookingId}`,
            note: `Reversal of redeem for booking ${bookingId}`,
            metadata: { reversesRedeemId: redeemEntry.id, bookingId },
          },
        })
        .catch(() => {});
    }
  }

  // Reverse referral bonus tied to this booking (same unique-key constraint).
  const referralBonus = await prisma.rewardLedgerEntry.findFirst({
    where: { bookingId, type: "REFERRAL_BONUS" },
    select: LEDGER_SELECT,
  });
  if (referralBonus) {
    const existingRefRev = await prisma.rewardLedgerEntry.findUnique({
      where: { idempotencyKey: `referral-reverse:${bookingId}` },
      select: { id: true },
    });
    if (!existingRefRev) {
      await prisma.rewardLedgerEntry
        .create({
          data: {
            accountId: referralBonus.accountId,
            type: "REVERSE",
            points: -referralBonus.points,
            bookingId: null,
            idempotencyKey: `referral-reverse:${bookingId}`,
            note: `Reversal of referral bonus for booking ${bookingId}`,
            metadata: { reversesReferralBonusId: referralBonus.id, bookingId },
          },
        })
        .catch(() => {});
    }
  }

  if (!earnEntry) return null;

  const existingReverse = await prisma.rewardLedgerEntry.findFirst({
    where: { bookingId, type: "REVERSE" },
    select: LEDGER_SELECT,
  });
  if (existingReverse) return existingReverse;

  try {
    const reversed = await prisma.rewardLedgerEntry.create({
      data: {
        accountId: earnEntry.accountId,
        type: "REVERSE",
        points: -earnEntry.points,
        bookingId,
        note: `Reversal of earn for booking ${bookingId}`,
      },
      select: LEDGER_SELECT,
    });
    await writeAudit({
      userId: null,
      action: "rewards.reverse",
      resourceType: "Booking",
      resourceId: bookingId,
      metadata: { points: reversed.points },
    });
    return reversed;
  } catch (e) {
    if (e.code === "P2002") {
      return prisma.rewardLedgerEntry.findFirst({
        where: { bookingId, type: "REVERSE" },
        select: LEDGER_SELECT,
      });
    }
    throw e;
  }
}

export async function redeemPoints(userId, points, { idempotencyKey, bookingId, note } = {}) {
  assertNonNegativeIntPoints(points, "points");
  if (points === 0) throw new AppError(400, "points must be greater than 0");

  const account = await ensureAccount(userId);

  if (idempotencyKey) {
    const existing = await prisma.rewardLedgerEntry.findUnique({
      where: { idempotencyKey },
      select: LEDGER_SELECT,
    });
    if (existing) return existing;
  }

  const entry = await prisma.$transaction(async (tx) => {
    const agg = await tx.rewardLedgerEntry.aggregate({
      where: { accountId: account.id },
      _sum: { points: true },
    });
    const balance = agg._sum.points || 0;
    if (points > balance) {
      throw new AppError(400, "Insufficient reward balance");
    }
    return tx.rewardLedgerEntry.create({
      data: {
        accountId: account.id,
        type: "REDEEM",
        points: -points,
        bookingId: bookingId || null,
        idempotencyKey: idempotencyKey || null,
        note: note || `Redeemed ${points} point(s)`,
        metadata: {
          creditMinor: creditMinorFromPoints(points),
        },
      },
      select: LEDGER_SELECT,
    });
  });

  await notifyReward(userId, {
    dedupeKey: `reward-redeem:${entry.id}`,
    title: "Rewards redeemed",
    body: `${points} reward point(s) were redeemed.`,
    payload: { kind: "redeem", points, bookingId: bookingId || null },
  });

  return entry;
}

/**
 * Apply reward points as checkout credit on a QUOTED booking.
 * Reduces customer-payable only (never supplier net). Idempotent via key.
 */
export async function applyRewardCreditToBooking(
  userId,
  bookingId,
  points,
  { idempotencyKey } = {},
) {
  assertNonNegativeIntPoints(points, "points");
  if (points === 0) throw new AppError(400, "points must be greater than 0");

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      amountMinor: true,
      netMinor: true,
      metadata: true,
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status !== "QUOTED") {
    throw new AppError(409, `Cannot apply rewards to booking in status ${booking.status}`);
  }

  const existingCredit =
    booking.metadata && typeof booking.metadata === "object"
      ? booking.metadata.rewardCredit
      : null;
  if (existingCredit && Number.isInteger(existingCredit.points)) {
    return {
      booking,
      redeem: existingCredit.ledgerId
        ? await prisma.rewardLedgerEntry.findUnique({
            where: { id: existingCredit.ledgerId },
            select: LEDGER_SELECT,
          })
        : null,
      chargeableAmountMinor: Math.max(
        0,
        booking.amountMinor - (existingCredit.creditMinor || 0),
      ),
      creditMinor: existingCredit.creditMinor || 0,
      points: existingCredit.points,
    };
  }

  const policy = getRewardsPolicy();
  let creditMinor = creditMinorFromPoints(points, policy);
  const maxCredit = Math.max(0, booking.amountMinor);
  if (creditMinor > maxCredit) {
    // Cap points to what can actually offset customer payable.
    const maxPoints = Math.floor(maxCredit / policy.pointValueMinor);
    if (maxPoints <= 0) {
      throw new AppError(400, "No payable amount available to offset with rewards");
    }
    points = maxPoints;
    creditMinor = creditMinorFromPoints(points, policy);
  }

  const key = idempotencyKey || `checkout-redeem:${bookingId}:${points}`;
  const redeem = await redeemPoints(userId, points, {
    idempotencyKey: key,
    bookingId,
    note: `Checkout credit for booking ${bookingId}`,
  });

  const meta =
    booking.metadata && typeof booking.metadata === "object" ? { ...booking.metadata } : {};
  meta.rewardCredit = {
    points,
    creditMinor,
    ledgerId: redeem.id,
    appliedAt: new Date().toISOString(),
    note: "Reduces customer payable only — supplier net unchanged",
  };

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { metadata: meta },
    select: {
      id: true,
      amountMinor: true,
      netMinor: true,
      marginMinor: true,
      metadata: true,
      status: true,
      currency: true,
    },
  });

  await writeAudit({
    userId,
    action: "rewards.checkout_credit",
    resourceType: "Booking",
    resourceId: bookingId,
    metadata: { points, creditMinor, ledgerId: redeem.id },
  });

  return {
    booking: updated,
    redeem,
    chargeableAmountMinor: Math.max(0, updated.amountMinor - creditMinor),
    creditMinor,
    points,
  };
}

export function chargeableAmountMinor(booking) {
  const amount = booking?.amountMinor ?? 0;
  const credit = booking?.metadata?.rewardCredit?.creditMinor;
  const c = Number.isInteger(credit) && credit > 0 ? credit : 0;
  return Math.max(0, amount - c);
}

export async function attachReferral(userId, code) {
  if (!code || typeof code !== "string") {
    throw new AppError(400, "code is required");
  }

  const referrerAccount = await prisma.rewardAccount.findUnique({
    where: { referralCode: code },
    select: { userId: true },
  });
  if (!referrerAccount) throw new AppError(404, "Invalid referral code");
  if (referrerAccount.userId === userId) {
    throw new AppError(400, "Cannot refer yourself");
  }

  const existingAttribution = await prisma.referralAttribution.findUnique({
    where: { referredUserId: userId },
    select: { id: true },
  });
  if (existingAttribution) {
    throw new AppError(409, "Already attributed to a referrer");
  }

  const referredUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const signupAt = referredUser?.createdAt ?? new Date();
  await ensureAccount(userId);

  try {
    const [attribution] = await prisma.$transaction([
      prisma.referralAttribution.create({
        data: {
          referrerUserId: referrerAccount.userId,
          referredUserId: userId,
          signupAt,
        },
      }),
      prisma.rewardAccount.update({
        where: { userId },
        data: { referredByUserId: referrerAccount.userId },
      }),
    ]);
    await writeAudit({
      userId,
      action: "rewards.referral_attach",
      resourceType: "User",
      resourceId: userId,
      metadata: { referrerUserId: referrerAccount.userId },
    });
    return attribution;
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError(409, "Already attributed to a referrer");
    }
    throw e;
  }
}

async function assertCompanyAdmin(userId, companyId) {
  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { role: true },
  });
  if (!membership) throw new AppError(403, "Not a member of this company");
  return membership;
}

async function assertCompanyRewardViewer(userId, companyId) {
  const membership = await assertCompanyAdmin(userId, companyId);
  if (!["ADMIN", "APPROVER"].includes(membership.role)) {
    throw new AppError(403, "Company ADMIN or APPROVER role required");
  }
  return membership;
}

export async function upsertCorporateProgram(userId, companyId, body = {}) {
  const membership = await assertCompanyAdmin(userId, companyId);
  if (membership.role !== "ADMIN") {
    throw new AppError(403, "Company ADMIN role required to configure rewards");
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new AppError(404, "Company not found");

  const companyEarn = Number.isInteger(body.companyEarnPointsPerHundredMinor)
    ? Math.max(0, body.companyEarnPointsPerHundredMinor)
    : 0;
  const personalEarnEnabled = body.personalEarnEnabled !== false;

  const program = await prisma.corporateRewardProgram.upsert({
    where: { companyId },
    create: {
      companyId,
      isActive: body.isActive !== false,
      companyEarnPointsPerHundredMinor: companyEarn,
      personalEarnEnabled,
      note: body.note || null,
    },
    update: {
      isActive: body.isActive !== false,
      companyEarnPointsPerHundredMinor: companyEarn,
      personalEarnEnabled,
      note: body.note || null,
    },
  });

  await writeAudit({
    userId,
    action: "rewards.corporate_program_upsert",
    resourceType: "Company",
    resourceId: companyId,
    metadata: { programId: program.id },
  });

  return program;
}

export async function getCorporateProgram(userId, companyId) {
  await assertCompanyRewardViewer(userId, companyId);
  const program = await prisma.corporateRewardProgram.findUnique({
    where: { companyId },
  });
  if (!program) {
    return { configured: false, companyId, balance: 0, program: null };
  }
  const agg = await prisma.corporateRewardLedgerEntry.aggregate({
    where: { companyId },
    _sum: { points: true },
  });
  return {
    configured: true,
    companyId,
    program,
    balance: agg._sum.points || 0,
  };
}

/** Expire aged EARN/REFERRAL_BONUS lots (worker). Idempotent via EXPIRE rows keyed in metadata. */
export async function runRewardExpiryScheduler({ now = new Date(), batchSize = 200 } = {}) {
  const due = await prisma.rewardLedgerEntry.findMany({
    where: {
      type: { in: ["EARN", "REFERRAL_BONUS"] },
      expiresAt: { lte: now },
      points: { gt: 0 },
    },
    take: batchSize,
    orderBy: { expiresAt: "asc" },
    select: LEDGER_SELECT,
  });

  let expired = 0;
  let skipped = 0;
  for (const lot of due) {
    const key = `expire-lot:${lot.id}`;
    const existing = await prisma.rewardLedgerEntry.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    // Remaining value of this lot: cannot expire more than still "attributable";
    // Phase-1: expire full original points if balance still covers (FIFO simplified).
    const balance = await sumPoints(lot.accountId);
    const toExpire = Math.min(lot.points, Math.max(0, balance));
    if (toExpire <= 0) {
      skipped += 1;
      continue;
    }
    await prisma.rewardLedgerEntry.create({
      data: {
        accountId: lot.accountId,
        type: "EXPIRE",
        points: -toExpire,
        idempotencyKey: key,
        note: `Expiry of ledger lot ${lot.id}`,
        metadata: { expiresLotId: lot.id },
      },
    });
    expired += 1;
  }
  return { scanned: due.length, expired, skipped };
}

/** Ava grounding — never invent balances. */
export async function getAvaRewardsContext(userId) {
  if (!userId) {
    return {
      promptBlock:
        "REWARDS: Guest session — rewards are account-based. Ask them to sign in. Never invent a balance, tier, or referral status.",
    };
  }
  const summary = await getBalance(userId);
  const referrals = await listMyReferrals(userId);
  return {
    summary,
    referrals,
    promptBlock: [
      "REWARDS (Module 10 — ledger data only):",
      `balance=${summary.balance}; tier=${summary.tier}; lifetimeEarned=${summary.lifetimeEarned}`,
      `nextTier=${summary.progress.nextTier || "none"}; pointsToNext=${summary.progress.pointsToNext}`,
      `referralCode=${summary.referralCode}; referralBonusPoints=${summary.policy.referralBonusPoints}`,
      `earnRate=${summary.policy.earnPointsPerHundredMinor} points per 100 minor; pointValueMinor=${summary.policy.pointValueMinor}`,
      `pendingReferrals=${referrals.items.filter((i) => i.status !== "REWARDED").length}`,
      "Never invent balances, tiers, or referral outcomes. Credits redeem at checkout against customer payable only.",
    ].join(" "),
  };
}

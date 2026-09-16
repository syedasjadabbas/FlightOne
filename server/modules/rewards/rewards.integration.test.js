/**
 * Module 10 — Rewards & Referrals tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();
process.env.NODE_ENV = "test";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const rewards = await import("./rewards.service.js");
const { computeTierFromLifetime, pointsFromBookingAmount, getRewardsPolicy } = await import(
  "./rewards.policy.js"
);

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.rwd.${label}.${suffix}@example.com`,
      name: `Rwd ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

async function createBooking(userId, status, amountMinor = 10000, metadata = {}) {
  return prisma.booking.create({
    data: {
      userId,
      status,
      product: "FLIGHT",
      currency: "PKR",
      amountMinor,
      netMinor: Math.floor(amountMinor * 0.9),
      marginMinor: amountMinor - Math.floor(amountMinor * 0.9),
      metadata,
    },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of users) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    const acc = await prisma.rewardAccount.findUnique({ where: { userId: id } });
    if (acc) {
      await prisma.rewardLedgerEntry.deleteMany({ where: { accountId: acc.id } }).catch(() => {});
      await prisma.rewardAccount.delete({ where: { id: acc.id } }).catch(() => {});
    }
    await prisma.referralAttribution.deleteMany({
      where: { OR: [{ referrerUserId: id }, { referredUserId: id }] },
    }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("rewards.policy", () => {
  it("computes tiers deterministically", () => {
    assert.equal(computeTierFromLifetime(0), "BRONZE");
    assert.equal(computeTierFromLifetime(1000), "SILVER");
    assert.equal(computeTierFromLifetime(5000), "GOLD");
    assert.equal(computeTierFromLifetime(20000), "PLATINUM");
  });

  it("earn points from amount use configurable rate", () => {
    const policy = getRewardsPolicy({ REWARD_EARN_POINTS_PER_HUNDRED_MINOR: "1" });
    assert.equal(pointsFromBookingAmount(1050, policy), 10);
  });
});

describe("rewards Module 10", () => {
  it("rejects earn on non-ticketed booking", async () => {
    const user = await createUser("quoted");
    const booking = await createBooking(user.id, "QUOTED", 50000);
    await assert.rejects(
      () =>
        rewards.earnForBooking({
          bookingId: booking.id,
          userId: user.id,
          amountMinor: booking.amountMinor,
        }),
      (err) => err.statusCode === 409,
    );
  });

  it("earns idempotently on ticketed booking", async () => {
    const user = await createUser("earn");
    const booking = await createBooking(user.id, "TICKETED", 10000);
    const a = await rewards.earnForBooking({
      bookingId: booking.id,
      userId: user.id,
      amountMinor: 10000,
    });
    const b = await rewards.earnForBooking({
      bookingId: booking.id,
      userId: user.id,
      amountMinor: 10000,
    });
    assert.ok(a);
    assert.equal(a.id, b.id);
    const bal = await rewards.getBalance(user.id);
    assert.equal(bal.balance, a.points);
  });

  it("redeems with insufficient balance rejected; double idempotent redeem", async () => {
    const user = await createUser("redeem");
    const booking = await createBooking(user.id, "TICKETED", 50000);
    await rewards.earnForBooking({
      bookingId: booking.id,
      userId: user.id,
      amountMinor: 50000,
    });
    await assert.rejects(
      () => rewards.redeemPoints(user.id, 999999),
      (err) => err.statusCode === 400,
    );
    const r1 = await rewards.redeemPoints(user.id, 10, { idempotencyKey: `idem-${suffix}` });
    const r2 = await rewards.redeemPoints(user.id, 10, { idempotencyKey: `idem-${suffix}` });
    assert.equal(r1.id, r2.id);
  });

  it("self-referral rejected; duplicate attribution rejected; bonus on first earn", async () => {
    const referrer = await createUser("refA");
    const referred = await createUser("refB");
    const refBal = await rewards.getBalance(referrer.id);
    await assert.rejects(
      () => rewards.attachReferral(referrer.id, refBal.referralCode),
      (err) => err.statusCode === 400,
    );
    await rewards.attachReferral(referred.id, refBal.referralCode);
    await assert.rejects(
      () => rewards.attachReferral(referred.id, refBal.referralCode),
      (err) => err.statusCode === 409,
    );
    const booking = await createBooking(referred.id, "TICKETED", 20000);
    await rewards.earnForBooking({
      bookingId: booking.id,
      userId: referred.id,
      amountMinor: 20000,
    });
    const after = await rewards.getBalance(referrer.id);
    assert.ok(after.balance >= getRewardsPolicy().referralBonusPoints);
  });

  it("checkout credit reduces chargeable without changing net", async () => {
    const user = await createUser("chk");
    const earnBooking = await createBooking(user.id, "TICKETED", 100000);
    await rewards.earnForBooking({
      bookingId: earnBooking.id,
      userId: user.id,
      amountMinor: 100000,
    });
    const quote = await createBooking(user.id, "QUOTED", 5000);
    const applied = await rewards.applyRewardCreditToBooking(user.id, quote.id, 10);
    assert.equal(applied.booking.netMinor, quote.netMinor);
    assert.ok(applied.chargeableAmountMinor < quote.amountMinor);
    assert.equal(
      rewards.chargeableAmountMinor(applied.booking),
      applied.chargeableAmountMinor,
    );
  });

  it("isolation — ledger is per user", async () => {
    const a = await createUser("isoA");
    const b = await createUser("isoB");
    const booking = await createBooking(a.id, "TICKETED", 30000);
    await rewards.earnForBooking({
      bookingId: booking.id,
      userId: a.id,
      amountMinor: 30000,
    });
    const balB = await rewards.getBalance(b.id);
    assert.equal(balB.balance, 0);
  });

  it("Ava context never invents for guests", async () => {
    const guest = await rewards.getAvaRewardsContext(null);
    assert.match(guest.promptBlock, /sign in/i);
  });

  it("corporate program requires company admin", async () => {
    const admin = await createUser("corpAdm");
    const company = await prisma.company.create({
      data: {
        name: `Rwd Co ${suffix}`,
        creditLimitMinor: 1_000_000,
        currency: "PKR",
      },
    });
    await prisma.companyMembership.create({
      data: { companyId: company.id, userId: admin.id, role: "ADMIN" },
    });
    const program = await rewards.upsertCorporateProgram(admin.id, company.id, {
      companyEarnPointsPerHundredMinor: 2,
      personalEarnEnabled: true,
    });
    assert.equal(program.companyEarnPointsPerHundredMinor, 2);
    const booking = await createBooking(admin.id, "TICKETED", 10000, {
      companyId: company.id,
    });
    await rewards.earnForBooking({
      bookingId: booking.id,
      userId: admin.id,
      amountMinor: 10000,
    });
    const corp = await rewards.getCorporateProgram(admin.id, company.id);
    assert.ok(corp.balance > 0);
    await prisma.corporateRewardLedgerEntry.deleteMany({ where: { companyId: company.id } });
    await prisma.corporateRewardProgram.delete({ where: { id: program.id } });
    await prisma.companyMembership.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  });

  it("reverses earn and referral bonus on refund path", async () => {
    const referrer = await createUser("revA");
    const referred = await createUser("revB");
    const ref = await rewards.getBalance(referrer.id);
    await rewards.attachReferral(referred.id, ref.referralCode);
    const booking = await createBooking(referred.id, "TICKETED", 20000);
    await rewards.earnForBooking({
      bookingId: booking.id,
      userId: referred.id,
      amountMinor: 20000,
    });
    const beforeRef = await rewards.getBalance(referrer.id);
    assert.ok(beforeRef.balance >= getRewardsPolicy().referralBonusPoints);
    await rewards.reverseRewardsForBooking(booking.id);
    await rewards.reverseRewardsForBooking(booking.id); // idempotent
    const afterRef = await rewards.getBalance(referrer.id);
    const afterUser = await rewards.getBalance(referred.id);
    assert.equal(afterUser.balance, 0);
    assert.ok(afterRef.balance < beforeRef.balance);
  });

  it("expiry scheduler is idempotent", async () => {
    const user = await createUser("exp");
    const account = await rewards.ensureAccount(user.id);
    const lot = await prisma.rewardLedgerEntry.create({
      data: {
        accountId: account.id,
        type: "EARN",
        points: 50,
        expiresAt: new Date(Date.now() - 1000),
        note: "test lot",
      },
    });
    const first = await rewards.runRewardExpiryScheduler({ now: new Date() });
    const second = await rewards.runRewardExpiryScheduler({ now: new Date() });
    assert.ok(first.expired >= 1);
    assert.ok(second.skipped >= 1 || second.expired === 0);
    await prisma.rewardLedgerEntry.deleteMany({ where: { accountId: account.id } });
    void lot;
  });
});

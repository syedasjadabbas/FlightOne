/**
 * Module 10 — configurable rewards policy (PRD does not hardcode rates).
 * Env-driven; never invent arbitrary rates as fixed product law.
 */
export function getRewardsPolicy(env = process.env) {
  const earnPerHundred = parsePositiveInt(env.REWARD_EARN_POINTS_PER_HUNDRED_MINOR, 1);
  const referralBonus = parsePositiveInt(env.REWARD_REFERRAL_BONUS_POINTS, 500);
  const pointValueMinor = parsePositiveInt(env.REWARD_POINT_VALUE_MINOR, 1);
  const expiryDays = parsePositiveInt(env.REWARD_CREDIT_EXPIRY_DAYS, 365);
  const silverAt = parsePositiveInt(env.REWARD_TIER_SILVER_AT, 1000);
  const goldAt = parsePositiveInt(env.REWARD_TIER_GOLD_AT, 5000);
  const platinumAt = parsePositiveInt(env.REWARD_TIER_PLATINUM_AT, 20000);

  const thresholds = [
    { tier: "BRONZE", minInclusive: 0, nextTier: "SILVER", nextAt: silverAt },
    { tier: "SILVER", minInclusive: silverAt, nextTier: "GOLD", nextAt: goldAt },
    { tier: "GOLD", minInclusive: goldAt, nextTier: "PLATINUM", nextAt: platinumAt },
    { tier: "PLATINUM", minInclusive: platinumAt, nextTier: null, nextAt: null },
  ];

  return {
    earnPointsPerHundredMinor: earnPerHundred,
    referralBonusPoints: referralBonus,
    pointValueMinor,
    creditExpiryDays: expiryDays,
    tierThresholds: thresholds,
    notificationChannels: parseChannels(env.REWARD_NOTIFICATION_CHANNELS),
  };
}

function parsePositiveInt(raw, fallback) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function parseChannels(raw) {
  const allowed = new Set(["APP", "EMAIL", "WHATSAPP"]);
  if (!raw || !String(raw).trim()) return ["APP", "EMAIL", "WHATSAPP"];
  const parsed = String(raw)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => allowed.has(c));
  return parsed.length ? [...new Set(parsed)] : ["APP", "EMAIL", "WHATSAPP"];
}

/** Deterministic tier from lifetime EARN points. */
export function computeTierFromLifetime(lifetimeEarned, policy = getRewardsPolicy()) {
  const n = Number(lifetimeEarned) || 0;
  let current = policy.tierThresholds[0];
  for (const row of policy.tierThresholds) {
    if (n >= row.minInclusive) current = row;
  }
  return current.tier;
}

export function tierProgress(lifetimeEarned, policy = getRewardsPolicy()) {
  const n = Number(lifetimeEarned) || 0;
  const tier = computeTierFromLifetime(n, policy);
  const row = policy.tierThresholds.find((t) => t.tier === tier) || policy.tierThresholds[0];
  if (!row.nextAt) {
    return { tier, lifetimeEarned: n, nextTier: null, pointsToNext: 0, progressRatio: 1 };
  }
  const span = row.nextAt - row.minInclusive;
  const into = Math.max(0, n - row.minInclusive);
  return {
    tier,
    lifetimeEarned: n,
    nextTier: row.nextTier,
    nextAt: row.nextAt,
    pointsToNext: Math.max(0, row.nextAt - n),
    progressRatio: span > 0 ? Math.min(1, into / span) : 1,
  };
}

export function pointsFromBookingAmount(amountMinor, policy = getRewardsPolicy()) {
  const amt = Number(amountMinor) || 0;
  if (amt <= 0) return 0;
  return Math.floor((amt / 100) * policy.earnPointsPerHundredMinor);
}

export function creditMinorFromPoints(points, policy = getRewardsPolicy()) {
  const p = Number(points) || 0;
  if (p <= 0) return 0;
  return p * policy.pointValueMinor;
}

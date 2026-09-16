/**
 * Module 04 — Intelligent Recommendation Engine.
 *
 * Pure ranking over already-priced offers. Learning loop aggregates this
 * user's RecommendationFeedback into bounded soft weights (see learning.js).
 * Chat/profile preferences always outrank learned weights.
 *
 * Product consultation uses frontend `curate()`; this API mirrors the same
 * Module 4 invariants (distinct Best/Cheapest/Fastest, thin inventory, no
 * fabricated quality/reliability, bounded learning).
 */
import { AppError } from "../../lib/customError.js";
import prisma from "../../config/prisma.js";
import {
  aggregateLearnedPreferences,
  computeLearnedBoost,
  sanitizeFeedbackContext,
} from "./learning.js";

export const WEIGHTS = {
  PRICE: 0.3,
  DURATION: 0.2,
  LAYOVER: 0.15,
  PREFERRED_AIRLINE: 0.12,
  LOYALTY_AIRLINE: 0.08,
  REFUNDABLE: 0.1,
  /** Applied only when pool has differentiated authoritative airlineScore values. */
  AIRLINE_QUALITY: 0.05,
  SUPPLIER_RELIABILITY: 0.05,
  RED_EYE_PENALTY: 0.15,
  MAX_LAYOVER_PENALTY: 0.1,
  LATE_ARRIVAL_PENALTY: 0.1,
  HUB_ALTERNATIVE: 0.05,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function buildCurrencyStats(offers) {
  const stats = new Map();
  for (const offer of offers) {
    const existing = stats.get(offer.currency);
    if (!existing) {
      stats.set(offer.currency, { min: offer.amountMinor, max: offer.amountMinor });
    } else {
      existing.min = Math.min(existing.min, offer.amountMinor);
      existing.max = Math.max(existing.max, offer.amountMinor);
    }
  }
  return stats;
}

function buildPriceScoreMap(offers, currencyStats) {
  const scores = new Map();
  for (const offer of offers) {
    const { min, max } = currencyStats.get(offer.currency);
    scores.set(offer.id, max === min ? 1 : (max - offer.amountMinor) / (max - min));
  }
  return scores;
}

function buildDurationScoreMap(offers) {
  const scores = new Map();
  const withDuration = offers.filter((o) => typeof o.durationMinutes === "number");
  if (withDuration.length === 0) {
    for (const offer of offers) scores.set(offer.id, 0.5);
    return scores;
  }
  const min = Math.min(...withDuration.map((o) => o.durationMinutes));
  const max = Math.max(...withDuration.map((o) => o.durationMinutes));
  for (const offer of offers) {
    if (typeof offer.durationMinutes !== "number") {
      scores.set(offer.id, 0.5);
      continue;
    }
    scores.set(offer.id, max === min ? 1 : (max - offer.durationMinutes) / (max - min));
  }
  return scores;
}

export function poolHasTrustedReliability(offers) {
  const values = offers
    .map((o) => o.supplierReliability)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return false;
  return new Set(values.map((v) => round2(v))).size > 1;
}

/**
 * Airline quality (PRD Module 4) is trusted only when ≥2 offers carry finite
 * airlineScore values that actually differ — never invent flat/default scores.
 */
export function poolHasTrustedAirlineQuality(offers) {
  const values = offers
    .map((o) => o.airlineScore)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return false;
  return new Set(values.map((v) => round2(v))).size > 1;
}

function offerAirlineQualityOrNull(offer) {
  if (typeof offer.airlineScore !== "number" || !Number.isFinite(offer.airlineScore)) {
    return null;
  }
  const v = offer.airlineScore;
  // Accept 0..1 or 0..100 (same convention as supplierReliability).
  return clamp(v > 1 ? v / 100 : v, 0, 1);
}

function poolHasNonstop(offers) {
  return offers.some((o) => o.layoverCount === 0);
}

function layoverScore(offer) {
  if (offer.layoverCount == null) return 0.6;
  if (offer.layoverCount === 0) return 1;

  let score = clamp(1 - offer.layoverCount * 0.3, 0, 1);
  if (typeof offer.layoverMinutes === "number" && offer.layoverCount > 0) {
    const avgLayoverMinutes = offer.layoverMinutes / offer.layoverCount;
    if (avgLayoverMinutes < 45) {
      score -= 0.2;
    } else if (avgLayoverMinutes > 180) {
      score -= 0.15;
    } else if (avgLayoverMinutes <= 120) {
      score += 0.05;
    }
  }
  return clamp(score, 0, 1);
}

function redEyePenaltyFlag(offer, preferences) {
  if (!preferences?.avoidRedEye) return 0;
  if (typeof offer.departHourLocal === "number") {
    return offer.departHourLocal >= 0 && offer.departHourLocal <= 5 ? 1 : 0;
  }
  if (typeof offer.departHourUtc === "number") {
    return offer.departHourUtc >= 0 && offer.departHourUtc <= 5 ? 1 : 0;
  }
  return 0;
}

function lateArrivalPenaltyFlag(offer, preferences) {
  if (!preferences?.avoidLateArrival) return 0;
  if (typeof offer.arriveHourLocal !== "number") return 0;
  return offer.arriveHourLocal >= 23 ? 1 : 0;
}

function preferredAirlineBoostFlag(offer, preferences) {
  if (!offer.airlineCode || !preferences?.preferredAirlines?.length) return 0;
  const code = offer.airlineCode.toUpperCase();
  return preferences.preferredAirlines.map((a) => a.toUpperCase()).includes(code) ? 1 : 0;
}

function loyaltyAirlineBoostFlag(offer, preferences) {
  if (!offer.airlineCode || !preferences?.loyaltyAirlineCodes?.length) return 0;
  const code = offer.airlineCode.toUpperCase();
  return preferences.loyaltyAirlineCodes.map((a) => a.toUpperCase()).includes(code) ? 1 : 0;
}

function maxLayoverPenaltyFlag(offer, preferences) {
  if (preferences?.maxLayovers == null || offer.layoverCount == null) return 0;
  return offer.layoverCount > preferences.maxLayovers ? 1 : 0;
}

function offerReliabilityOrNull(offer) {
  if (typeof offer.supplierReliability !== "number" || !Number.isFinite(offer.supplierReliability)) {
    return null;
  }
  const v = offer.supplierReliability;
  return clamp(v > 1 ? v / 100 : v, 0, 1);
}

function offerTags(offer) {
  return Array.isArray(offer.tags) ? offer.tags : [];
}

/**
 * Score a single offer. `learned` is softest; skipped when explicit prefs set.
 */
export function scoreOffer(offer, {
  priceScore,
  durationScore,
  preferences,
  reliabilityTrusted,
  airlineQualityTrusted,
  learned,
  noNonstopInPool,
}) {
  const preferred = preferredAirlineBoostFlag(offer, preferences);
  const loyalty = loyaltyAirlineBoostFlag(offer, preferences);
  const loyaltyEffective = preferred === 1 ? loyalty * 0.25 : loyalty;

  const reliabilityRaw = offerReliabilityOrNull(offer);
  const reliabilityApplies = reliabilityTrusted && reliabilityRaw != null;
  const supplierReliability = reliabilityApplies ? reliabilityRaw : null;

  const qualityRaw = offerAirlineQualityOrNull(offer);
  const airlineQualityApplies = airlineQualityTrusted && qualityRaw != null;
  const airlineQuality = airlineQualityApplies ? qualityRaw : null;

  const learnedBoost = computeLearnedBoost(
    {
      airlineCode: offer.airlineCode,
      stops: offer.layoverCount,
      refundable: offer.refundable === true ? true : offer.refundable === false ? false : null,
    },
    learned,
    {
      hasExplicitAirlinePreference: !!preferences?.preferredAirlines?.length,
      hasExplicitNonstopPreference: preferences?.maxLayovers === 0,
      hasExplicitRefundablePreference: preferences?.refundableOnly === true,
    },
  );

  const tags = offerTags(offer);
  const hubAlt =
    noNonstopInPool && (tags.includes("hub-stitched") || tags.includes("nearby-airport")) ? 1 : 0;

  const breakdown = {
    priceScore: round2(priceScore),
    durationScore: round2(durationScore),
    layoverScore: round2(layoverScore(offer)),
    preferredAirlineBoost: preferred,
    loyaltyAirlineBoost: round2(loyaltyEffective),
    refundableBoost: offer.refundable === true ? 1 : 0,
    airlineQuality: airlineQuality == null ? null : round2(airlineQuality),
    airlineQualityTrusted: airlineQualityApplies,
    supplierReliability: supplierReliability == null ? null : round2(supplierReliability),
    reliabilityTrusted: reliabilityApplies,
    redEyePenalty: redEyePenaltyFlag(offer, preferences),
    lateArrivalPenalty: lateArrivalPenaltyFlag(offer, preferences),
    maxLayoverPenalty: maxLayoverPenaltyFlag(offer, preferences),
    learnedBoost: round2(learnedBoost.deltaWeight),
    hubAlternativeBoost: hubAlt,
    learnedReasons: learnedBoost.reasons,
  };

  const positive =
    WEIGHTS.PRICE * breakdown.priceScore +
    WEIGHTS.DURATION * breakdown.durationScore +
    WEIGHTS.LAYOVER * breakdown.layoverScore +
    WEIGHTS.PREFERRED_AIRLINE * breakdown.preferredAirlineBoost +
    WEIGHTS.LOYALTY_AIRLINE * breakdown.loyaltyAirlineBoost +
    WEIGHTS.REFUNDABLE * breakdown.refundableBoost +
    (airlineQualityApplies ? WEIGHTS.AIRLINE_QUALITY * breakdown.airlineQuality : 0) +
    (reliabilityApplies
      ? WEIGHTS.SUPPLIER_RELIABILITY * breakdown.supplierReliability
      : 0) +
    WEIGHTS.HUB_ALTERNATIVE * breakdown.hubAlternativeBoost +
    breakdown.learnedBoost;

  const penalty =
    WEIGHTS.RED_EYE_PENALTY * breakdown.redEyePenalty +
    WEIGHTS.LATE_ARRIVAL_PENALTY * breakdown.lateArrivalPenalty +
    WEIGHTS.MAX_LAYOVER_PENALTY * breakdown.maxLayoverPenalty;

  const score = Math.round(clamp(positive - penalty, 0, 1) * 1000) / 10;

  return { score, breakdown };
}

function formatDuration(durationMinutes) {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  return `${hours}h${mins ? ` ${mins}m` : ""}`;
}

function buildExplanation({ offer, breakdown }, label, currencyStats) {
  const facts = [];
  const { min, max } = currencyStats.get(offer.currency) || {
    min: offer.amountMinor,
    max: offer.amountMinor,
  };

  if (max > min) {
    const cheaperThanMaxPct = Math.round(((max - offer.amountMinor) / max) * 1000) / 10;
    if (offer.amountMinor === min) {
      facts.push(`the cheapest of the ${offer.currency} options shown`);
    } else if (cheaperThanMaxPct > 0) {
      facts.push(`${cheaperThanMaxPct}% cheaper than the priciest ${offer.currency} option shown`);
    }
  }

  if (breakdown.layoverScore >= 0.99 && offer.layoverCount === 0) {
    facts.push("non-stop");
  } else if (typeof offer.layoverCount === "number") {
    facts.push(`${offer.layoverCount} layover${offer.layoverCount === 1 ? "" : "s"}`);
  }

  if (typeof offer.durationMinutes === "number") {
    facts.push(`${formatDuration(offer.durationMinutes)} total journey time`);
  }

  if (breakdown.preferredAirlineBoost === 1) facts.push("matches your preferred airline");
  if (breakdown.loyaltyAirlineBoost > 0) facts.push("aligns with your loyalty membership");
  if (breakdown.refundableBoost === 1 && offer.refundable === true) facts.push("refundable fare");
  if (breakdown.airlineQualityTrusted && breakdown.airlineQuality != null) {
    const pct = Math.round(breakdown.airlineQuality * 100);
    if (pct >= 90) {
      facts.push(
        `${offer.airlineCode || "carrier"} — higher quality score in this result set`,
      );
    } else {
      facts.push(`airline quality ${pct}% in this result set`);
    }
  }
  if (breakdown.redEyePenalty === 1) facts.push("departs during red-eye hours (00:00–05:59)");
  if (breakdown.lateArrivalPenalty === 1) facts.push("arrives late (23:00+ local)");
  if (breakdown.maxLayoverPenalty === 1) facts.push("exceeds your max-layover preference");
  if (breakdown.reliabilityTrusted) {
    facts.push(
      `supplier reliability ${Math.round(breakdown.supplierReliability * 100)}% in this result set`,
    );
  }
  if (breakdown.hubAlternativeBoost === 1) {
    const tags = offerTags(offer);
    if (tags.includes("hub-stitched")) facts.push("hub-connected alternative");
    else if (tags.includes("nearby-airport")) facts.push("nearby airport alternative");
  }
  for (const r of breakdown.learnedReasons ?? []) {
    facts.push(r.charAt(0).toLowerCase() + r.slice(1));
  }

  const lead =
    {
      best_overall: "Best overall pick",
      cheapest: "Cheapest option",
      fastest: "Fastest itinerary",
      recommended: "Also worth considering",
    }[label] ?? "Ranked option";

  return `${lead}: ${facts.join(", ") || "ranked from available inventory"}.`;
}

function selectCurated(scored, limit) {
  const byOverall = [...scored].sort((a, b) => b.score - a.score);
  const byPrice = [...scored].sort(
    (a, b) => b.breakdown.priceScore - a.breakdown.priceScore || a.offer.amountMinor - b.offer.amountMinor,
  );
  const byDuration = [...scored].sort(
    (a, b) =>
      b.breakdown.durationScore - a.breakdown.durationScore ||
      (a.offer.durationMinutes ?? Infinity) - (b.offer.durationMinutes ?? Infinity),
  );

  const usedIds = new Set();
  const picks = [];

  const takeFirstUnused = (list, label) => {
    const found = list.find((item) => !usedIds.has(item.offer.id));
    if (!found) return;
    usedIds.add(found.offer.id);
    picks.push({ ...found, label });
  };

  takeFirstUnused(byOverall, "best_overall");
  takeFirstUnused(byPrice, "cheapest");
  takeFirstUnused(byDuration, "fastest");

  if (limit > 3) {
    for (const item of byOverall) {
      if (picks.length >= limit) break;
      if (usedIds.has(item.offer.id)) continue;
      usedIds.add(item.offer.id);
      picks.push({ ...item, label: "recommended" });
    }
  }

  return picks.slice(0, limit);
}

/**
 * Rank offers. Pass `learned` from getLearnedPreferences(userId) for user isolation.
 */
export function rankOffers({
  offers,
  preferences,
  learned = null,
  limit = 3,
  includeAll = false,
}) {
  if (!Array.isArray(offers) || offers.length === 0) {
    throw new AppError(400, "offers must contain at least one offer");
  }

  const currencyStats = buildCurrencyStats(offers);
  const priceScores = buildPriceScoreMap(offers, currencyStats);
  const durationScores = buildDurationScoreMap(offers);
  const reliabilityTrusted = poolHasTrustedReliability(offers);
  const airlineQualityTrusted = poolHasTrustedAirlineQuality(offers);
  const noNonstopInPool = !poolHasNonstop(offers);

  const scored = offers.map((offer) => {
    const { score, breakdown } = scoreOffer(offer, {
      priceScore: priceScores.get(offer.id),
      durationScore: durationScores.get(offer.id),
      preferences,
      reliabilityTrusted,
      airlineQualityTrusted,
      learned,
      noNonstopInPool,
    });
    return { offer, score, breakdown };
  });

  const curatedPicks = selectCurated(scored, limit);
  const curatedIds = new Set(curatedPicks.map((p) => p.offer.id));

  const curated = curatedPicks.map((pick) => ({
    offer: pick.offer,
    score: pick.score,
    breakdown: pick.breakdown,
    label: pick.label,
    explanation: buildExplanation(pick, pick.label, currencyStats),
  }));

  const result = { curated };

  if (includeAll) {
    result.allRanked = [...scored]
      .sort((a, b) => b.score - a.score)
      .map((item) => {
        const label = curatedIds.has(item.offer.id)
          ? curatedPicks.find((p) => p.offer.id === item.offer.id).label
          : "other";
        return {
          offer: item.offer,
          score: item.score,
          breakdown: item.breakdown,
          label,
          explanation: buildExplanation(item, label, currencyStats),
        };
      });
  }

  return result;
}

/**
 * Load this user's feedback only and aggregate into bounded learned prefs.
 */
export async function getLearnedPreferences(userId) {
  if (!userId) {
    return aggregateLearnedPreferences([]);
  }
  const rows = await prisma.recommendationFeedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { signal: true, context: true },
  });
  return aggregateLearnedPreferences(
    rows.map((r) => ({
      signal: r.signal,
      context: r.context && typeof r.context === "object" ? r.context : null,
    })),
  );
}

/**
 * Persist feedback for this user only. Context must be real offer attributes.
 */
export async function recordFeedback(userId, { offerId, conversationId, signal, context }) {
  const safeContext = sanitizeFeedbackContext(context);
  return prisma.recommendationFeedback.create({
    data: {
      userId,
      offerId,
      conversationId: conversationId ?? null,
      signal,
      context: safeContext ?? undefined,
    },
    select: {
      id: true,
      userId: true,
      offerId: true,
      conversationId: true,
      signal: true,
      context: true,
      createdAt: true,
    },
  });
}

/** Rank with this user's learned prefs loaded from DB (isolated). */
export async function rankOffersForUser(userId, body) {
  const learned = await getLearnedPreferences(userId);
  return rankOffers({ ...body, learned });
}

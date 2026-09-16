import type { IntentFilters } from "@/lib/consultant/types";
import type { PricedOffer } from "@/lib/pricing/pricing";
import { isFlight, isHotel, isPackage } from "@/lib/inventory/types";
import { hasCheckedBaggageIncluded } from "@/lib/inventory/fareDisplay";
import { formatMoney } from "@/utils/money";
import { airlineIataCode, airlineMatchesPreference } from "@/lib/consultant/airlines";
import {
  computeLearnedBoost,
  type LearnedPreferences,
} from "@/lib/recommendation/learning";

/**
 * Intelligent Recommendation Engine — Module 04 (consumed by Module 01 Ava).
 *
 * Pure scoring/curation over already-priced offers. Never touches pricing
 * (Module 05). Surfaces a differentiated top-3: best overall / cheapest /
 * fastest — with reasons derived only from real offer attributes.
 *
 * Learning loop capture: ResultsRail OfferFeedbackControls → RTK
 * `POST /recommendations/feedback`; learned prefs load via
 * `GET /recommendations/learned` on chat turns. This module only exposes
 * the signal contract and ranking that consumes learned weights.
 */

export type OfferAngle =
  | "best_value"
  | "cheapest"
  | "fastest"
  | "premium"
  | "top_rated"
  | "recommended";

export interface ScoredOffer {
  priced: PricedOffer;
  score: number; // 0–100
  /** Human-readable reasons, derived from the actual factors used (Module 01 surfaces these). */
  reasons: string[];
  angle: OfferAngle;
}

/**
 * Preference context for ranking — conversation filters + latest message win;
 * profile soft signals fill gaps only via `buildRankContext`.
 */
export type RankContext = {
  filters?: IntentFilters;
  /**
   * Latest explicit optimization preference. When set, overrides balanced scoring.
   * Inferred from the current user message so latest intent wins.
   */
  priority?: "price" | "speed" | "value";
  /**
   * Soft loyalty membership airline codes (Module 02). Boost + explain only on
   * real airline match — never invent miles or status perks.
   */
  loyaltyAirlineCodes?: string[];
  /** Soft red-eye avoidance (profile/chat). Only applied when depart time is known. */
  avoidRedEye?: boolean;
  /** Soft late-arrival avoidance when arriveTimeLocal is known. */
  avoidLateArrival?: boolean;
  /**
   * Bounded learned preferences from this user's RecommendationFeedback.
   * Softest signal — always overridden by chat intent and profile filters.
   */
  learned?: LearnedPreferences | null;
};

/** Learning-ready feedback signals (persisted server-side). */
export type {
  RecommendationFeedbackSignal,
  LearnedPreferences,
  FeedbackEvent,
  FeedbackOfferContext,
} from "./learning";
export {
  aggregateLearnedPreferences,
  computeLearnedBoost,
  LEARNING_BOUNDS,
} from "./learning";

/** API paths for Module 04 feedback capture + learned prefs. */
export const RECOMMENDATION_FEEDBACK_PATH = "/recommendations/feedback";
export const RECOMMENDATION_LEARNED_PATH = "/recommendations/learned";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Infer ranking priority from the latest user message + filters (latest wins). */
export function inferRankPriority(
  message: string,
  filters?: IntentFilters,
): RankContext["priority"] {
  const m = message.toLowerCase();
  if (
    /\b(care more about price|prioriti[sz]e price|cheapest|lowest (?:fare|price)|best price|budget)\b/.test(
      m,
    )
  ) {
    return "price";
  }
  if (
    /\b(fastest|quickest|shortest(?:\s+total)?(?:\s+journey)?|prefer (?:non[-\s]?stop|direct)|no long layovers?)\b/.test(
      m,
    ) ||
    filters?.nonstopOnly
  ) {
    return "speed";
  }
  if (/\b(best (?:overall|value)|balanced|best option)\b/.test(m)) {
    return "value";
  }
  return undefined;
}

/** Infer soft time prefs from the latest message (does not invent hard filters). */
export function inferSoftTimePrefs(message: string): {
  avoidRedEye?: boolean;
  avoidLateArrival?: boolean;
} {
  const m = message.toLowerCase();
  const out: { avoidRedEye?: boolean; avoidLateArrival?: boolean } = {};
  if (
    /\b(no red[-\s]?eye|avoid red[-\s]?eye|not a red[-\s]?eye|no overnight (?:flight|depart)|don'?t want (?:an? )?(?:early|overnight)|avoid early morning)\b/.test(
      m,
    )
  ) {
    out.avoidRedEye = true;
  }
  if (
    /\b(avoid late arrival|not arrive late|don'?t want to arrive late|arrive before (?:midnight|23|11\s*pm)|no late night arrival)\b/.test(
      m,
    )
  ) {
    out.avoidLateArrival = true;
  }
  return out;
}

export type RankProfileSoftDefaults = {
  loyaltyAirlineCodes?: string[];
  avoidRedEye?: boolean;
  avoidLateArrival?: boolean;
  learned?: LearnedPreferences | null;
};

/**
 * Build RankContext: latest chat intent (priority + soft time prefs) wins;
 * profile loyalty/time defaults apply only when chat did not set them;
 * learned prefs are softest and never override chat/profile filters.
 */
export function buildRankContext(
  message: string,
  filters?: IntentFilters,
  profile?: RankProfileSoftDefaults | null,
): RankContext {
  const soft = inferSoftTimePrefs(message);
  return {
    filters,
    priority: inferRankPriority(message, filters),
    loyaltyAirlineCodes: profile?.loyaltyAirlineCodes?.length
      ? [...profile.loyaltyAirlineCodes]
      : undefined,
    avoidRedEye: soft.avoidRedEye ?? profile?.avoidRedEye,
    avoidLateArrival: soft.avoidLateArrival ?? profile?.avoidLateArrival,
    learned: profile?.learned ?? null,
  };
}

function formatDurationShort(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseHHMM(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/** True when defined airlineScore values vary in the flight pool. */
export function poolHasDifferentiatedAirlineQuality(pool: PricedOffer[]): boolean {
  const scores = pool
    .map((p) => p.offer)
    .filter(isFlight)
    .map((f) => f.airlineScore)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (scores.length < 2) return false;
  return new Set(scores).size > 1;
}

/** True when defined supplierReliability values vary across the pool. */
export function poolHasDifferentiatedReliability(pool: PricedOffer[]): boolean {
  const scores = pool
    .map((p) => p.offer.supplierReliability)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (scores.length < 2) return false;
  return new Set(scores).size > 1;
}

function totalJourneyMinutes(p: PricedOffer): number {
  const o = p.offer;
  if (!isFlight(o)) return Number.POSITIVE_INFINITY;
  const out = o.durationMinutes > 0 ? o.durationMinutes : 0;
  const ret =
    o.returnDurationMinutes && o.returnDurationMinutes > 0
      ? o.returnDurationMinutes
      : 0;
  return out + ret;
}

function maxKnownLayoverMinutes(o: {
  segments?: Array<{ layoverMinutesAfter?: number | null }>;
}): number | null {
  if (!o.segments?.length) return null;
  let max = 0;
  let any = false;
  for (const s of o.segments) {
    if (typeof s.layoverMinutesAfter === "number" && s.layoverMinutesAfter >= 0) {
      any = true;
      max = Math.max(max, s.layoverMinutesAfter);
    }
  }
  return any ? max : null;
}

function poolHasNonstopFlight(pool: PricedOffer[]): boolean {
  return pool.some((p) => isFlight(p.offer) && p.offer.stops === 0);
}

/** Score a single priced offer in the context of the candidate pool. */
function scoreOne(
  p: PricedOffer,
  pool: PricedOffer[],
  ctx?: RankContext,
): ScoredOffer {
  const prices = pool.map((x) => x.customerPrice.amount);
  const cheapest = Math.min(...prices);
  const dearest = Math.max(...prices);
  const spread = Math.max(1, dearest - cheapest);
  const airlineQualityTrusted = poolHasDifferentiatedAirlineQuality(pool);
  const reliabilityTrusted = poolHasDifferentiatedReliability(pool);
  const filters = ctx?.filters;
  const priority = ctx?.priority;
  const flightPoolMins = pool
    .filter((x) => isFlight(x.offer))
    .map((x) => totalJourneyMinutes(x))
    .filter((m) => Number.isFinite(m));
  const shortestJourney =
    flightPoolMins.length > 0 ? Math.min(...flightPoolMins) : null;
  const longestJourney =
    flightPoolMins.length > 0 ? Math.max(...flightPoolMins) : null;
  const noNonstopInPool = !poolHasNonstopFlight(pool);

  const reasons: string[] = [];
  let score = 0;

  // Price — relative to cheapest in pool.
  const priceWeight = priority === "price" ? 55 : priority === "speed" ? 18 : 40;
  const priceScore = priceWeight * (1 - (p.customerPrice.amount - cheapest) / spread);
  score += priceScore;
  if (p.customerPrice.amount === cheapest) {
    reasons.push(`Cheapest option at ${formatMoney(p.customerPrice)}`);
  }

  // Market edge — only when real savings vs market exist (25 pts).
  if (p.hasMarketEdge) {
    score += clamp(p.savingsVsMarketPct * 2, 0, 25);
    reasons.push(`~${p.savingsVsMarketPct}% under typical Booking.com/Trip.com price`);
  }

  // Supplier reliability — only when real differentiated values exist on offers.
  if (
    reliabilityTrusted &&
    typeof p.offer.supplierReliability === "number" &&
    Number.isFinite(p.offer.supplierReliability)
  ) {
    score += (p.offer.supplierReliability / 100) * 10;
  }

  const o = p.offer;
  if (isFlight(o)) {
    const durationWeight = priority === "speed" ? 36 : priority === "price" ? 10 : 18;
    const journeyMins = totalJourneyMinutes(p);
    if (
      shortestJourney != null &&
      longestJourney != null &&
      Number.isFinite(journeyMins) &&
      longestJourney > shortestJourney
    ) {
      const rel =
        (longestJourney - journeyMins) / (longestJourney - shortestJourney);
      score += durationWeight * rel;
    } else {
      const durScore = clamp(
        durationWeight - (o.durationMinutes - 90) / 45,
        0,
        durationWeight,
      );
      score += durScore;
    }

    if (o.stops === 0) {
      score += priority === "speed" ? 20 : 14;
      reasons.push("Direct — saves connection time");
    } else if (o.stops === 1) {
      score += 2;
    } else if (o.stops >= 2) {
      score -= 6;
    }

    // Layover comfort from real segment data (even without an explicit max).
    const maxLay = maxKnownLayoverMinutes(o);
    if (maxLay != null && o.stops > 0) {
      if (maxLay < 45) {
        score -= 14;
        reasons.push(`Tight connection (${formatDurationShort(maxLay)})`);
      } else if (maxLay <= 120) {
        score += 6;
      } else if (maxLay > 180) {
        score -= 10;
        reasons.push(`Long layover (${formatDurationShort(maxLay)})`);
      }
    }

    if (filters?.maxLayoverMinutes != null && maxLay != null) {
      if (maxLay > 0 && maxLay <= filters.maxLayoverMinutes) {
        score += 14;
        reasons.push(
          `Layover within your ${Math.round(filters.maxLayoverMinutes / 60)}h limit`,
        );
      } else if (maxLay > filters.maxLayoverMinutes) {
        score -= 40;
      }
    }

    const preferredMatch =
      !!filters?.preferredAirlines?.length &&
      airlineMatchesPreference(o.airline, filters.preferredAirlines);
    if (filters?.preferredAirlines?.length) {
      if (preferredMatch) {
        score += 35;
        reasons.push(`Matches your preferred airline (${o.airline})`);
      } else {
        score -= 12;
      }
    }

    // Loyalty — soft boost + grounded reason only when membership airline matches.
    if (ctx?.loyaltyAirlineCodes?.length) {
      if (airlineMatchesPreference(o.airline, ctx.loyaltyAirlineCodes)) {
        if (!preferredMatch) score += 18;
        else score += 3;
        reasons.push(`Aligns with your ${o.airline} loyalty membership`);
      }
    }

    const departMins = parseHHMM(o.departTimeLocal);
    if (departMins != null) {
      if (filters?.departAfterLocal) {
        const after = parseHHMM(filters.departAfterLocal);
        if (after != null) {
          if (departMins >= after) score += 6;
          else score -= 10;
        }
      }
      if (filters?.departBeforeLocal) {
        const before = parseHHMM(filters.departBeforeLocal);
        if (before != null) {
          if (departMins <= before) score += 6;
          else score -= 10;
        }
      }
      // Red-eye: only when customer asked / soft default, and local depart is known.
      if (ctx?.avoidRedEye && departMins >= 0 && departMins < 6 * 60) {
        score -= 28;
        reasons.push("Departs during red-eye hours (00:00–05:59 local)");
      } else if (
        !ctx?.avoidRedEye &&
        !filters?.departAfterLocal &&
        departMins >= 8 * 60 &&
        departMins <= 18 * 60
      ) {
        // Mild daytime convenience only when no explicit window — never invent quality.
        score += 2;
      }
    }

    const arriveMins = parseHHMM(o.arriveTimeLocal);
    if (arriveMins != null) {
      if (filters?.arriveBeforeLocal) {
        const before = parseHHMM(filters.arriveBeforeLocal);
        if (before != null) {
          if (arriveMins <= before) score += 6;
          else score -= 10;
        }
      }
      if (ctx?.avoidLateArrival && arriveMins >= 23 * 60) {
        score -= 22;
        reasons.push("Arrives late (23:00+ local)");
      }
    }

    // Refundability — score only when supplier marks refundable true (never invent).
    if (o.refundable === true) {
      score += filters?.refundableOnly ? 10 : 6;
      reasons.push("Refundable fare");
    } else if (filters?.refundableOnly && o.refundable === false) {
      score -= 8;
    }

    if (filters?.checkedBagRequired) {
      if (hasCheckedBaggageIncluded(o.fareMetadata?.baggageAllowance, o.baggageKg)) {
        score += 8;
        reasons.push("Checked baggage included");
      } else if (o.fareMetadata?.baggageAllowance || o.baggageKg != null) {
        // Real allowance known but checked bag not included — don't invent inclusion.
        score -= 4;
      }
    }

    // Airline quality — only when trusted differentiated data exists on this offer.
    if (
      airlineQualityTrusted &&
      typeof o.airlineScore === "number" &&
      Number.isFinite(o.airlineScore)
    ) {
      score += (o.airlineScore / 100) * 10;
      if (o.airlineScore >= 90) {
        reasons.push(`${o.airline} — higher quality score in this result set`);
      }
    }
    if (
      reliabilityTrusted &&
      typeof o.supplierReliability === "number" &&
      Number.isFinite(o.supplierReliability) &&
      o.supplierReliability >= 92 &&
      pool.some(
        (x) =>
          typeof x.offer.supplierReliability === "number" &&
          (x.offer.supplierReliability as number) < o.supplierReliability!,
      )
    ) {
      reasons.push("Higher supplier reliability in this result set");
    }

    // Practical alternatives from real inventory when exact nonstop is unavailable.
    if (noNonstopInPool) {
      if (o.tags.includes("hub-stitched")) {
        score += 10;
        reasons.push("Hub-connected alternative (multi-ticket)");
      } else if (o.tags.includes("nearby-airport")) {
        score += 8;
        reasons.push("Uses a nearby airport alternative");
      }
    } else {
      if (o.tags.includes("hub-stitched")) {
        reasons.push("Hub-connected alternative (multi-ticket)");
      }
      if (o.tags.includes("nearby-airport")) {
        reasons.push("Uses a nearby airport alternative");
      }
    }

    // Learned feedback — softest signal; skipped when chat/profile already set explicit prefs.
    const learnedBoost = computeLearnedBoost(
      {
        airlineCode: airlineIataCode(o.airline),
        stops: o.stops,
        refundable: o.refundable === true ? true : o.refundable === false ? false : null,
      },
      ctx?.learned,
      {
        hasExplicitAirlinePreference: !!filters?.preferredAirlines?.length,
        hasExplicitNonstopPreference: !!filters?.nonstopOnly || filters?.maxStops === 0,
        hasExplicitRefundablePreference: !!filters?.refundableOnly,
      },
    );
    if (learnedBoost.deltaPoints !== 0) {
      score += learnedBoost.deltaPoints;
      reasons.push(...learnedBoost.reasons);
    }
  } else if (isHotel(o)) {
    score += (o.ratingScore / 10) * 15;
    score += (o.stars / 5) * 10;
    if (o.ratingScore >= 9) reasons.push(`Guest score ${o.ratingScore}/10`);
    if (o.breakfastIncluded) reasons.push("Breakfast included");
    if (o.distanceToCentreKm <= 1.5) reasons.push("Walk to the centre");
    if (o.refundable) reasons.push("Free cancellation");
  } else if (isPackage(o)) {
    score += (o.stars / 5) * 12;
    score += 8;
    reasons.push(`${o.nights}-night flight + ${o.stars}★ hotel bundle`);
    if (p.savingsVsMarketPct >= 10) reasons.push("Bundle saves vs booking separately");
  }

  if (p.offer.unitsLeft != null && p.offer.unitsLeft <= 3) {
    reasons.push(`Only ${p.offer.unitsLeft} left at this fare`);
  }

  // Dedupe reasons while preserving order.
  const uniqReasons = [...new Set(reasons)];

  return {
    priced: p,
    score: clamp(Math.round(score)),
    reasons: uniqReasons,
    angle: "best_value",
  };
}

/** Rank all candidates by overall score (best first). */
export function rank(pool: PricedOffer[], ctx?: RankContext): ScoredOffer[] {
  return pool.map((p) => scoreOne(p, pool, ctx)).sort((a, b) => b.score - a.score);
}

function reasonsForCuratedAngle(
  s: ScoredOffer,
  angle: OfferAngle,
  pool: PricedOffer[],
): string[] {
  const p = s.priced;
  const o = p.offer;
  const priceLabel = formatMoney(p.customerPrice);

  if (angle === "cheapest") {
    return [`Cheapest option at ${priceLabel}`];
  }

  if (angle === "fastest" && isFlight(o)) {
    const mins = totalJourneyMinutes(p);
    const dur = formatDurationShort(mins);
    return [
      dur
        ? `Fastest option with the shortest total journey (${dur})`
        : "Fastest option with the shortest total journey",
    ];
  }

  if (angle === "best_value") {
    const prices = pool.map((x) => x.customerPrice.amount);
    const cheapestAmt = Math.min(...prices);
    const delta = p.customerPrice.amount - cheapestAmt;
    const base = [...s.reasons];

    if (isFlight(o)) {
      const cheapestFlight = pool
        .filter((x) => isFlight(x.offer))
        .sort((a, b) => a.customerPrice.amount - b.customerPrice.amount)[0];
      const fastestFlight = pool
        .filter((x) => isFlight(x.offer))
        .sort((a, b) => totalJourneyMinutes(a) - totalJourneyMinutes(b))[0];

      if (
        cheapestFlight &&
        fastestFlight &&
        p.offer.id !== cheapestFlight.offer.id &&
        totalJourneyMinutes(p) < totalJourneyMinutes(cheapestFlight) &&
        delta > 0
      ) {
        return [
          `Best overall because it offers a shorter journey for a small price difference (${priceLabel})`,
          ...base.filter((r) => !r.startsWith("Cheapest option")),
        ].slice(0, 3);
      }
      if (o.stops === 0 && delta === 0) {
        return [`Best overall — direct flight at the lowest price (${priceLabel})`, ...base].slice(
          0,
          3,
        );
      }
    }

    if (delta === 0) {
      return [`Best overall at ${priceLabel}`, ...base.filter((r) => !r.startsWith("Cheapest"))].slice(
        0,
        3,
      );
    }
    return [
      `Best overall balance of price and journey (${priceLabel})`,
      ...base.filter((r) => !r.startsWith("Cheapest option")),
    ].slice(0, 3);
  }

  return s.reasons.slice(0, 3);
}

/**
 * Curate a differentiated top-N (default 3) per PRD Module 4:
 * Best Overall, Cheapest, Fastest — never three copies of the same offer when
 * distinct valid alternatives exist. Returns fewer than N when the pool is thin.
 */
export function curate(
  pool: PricedOffer[],
  n = 3,
  ctx?: RankContext,
): ScoredOffer[] {
  if (pool.length === 0) return [];
  const ranked = rank(pool, ctx);

  const chosen: ScoredOffer[] = [];
  const take = (s: ScoredOffer | undefined, angle: OfferAngle) => {
    if (!s) return;
    if (chosen.some((c) => c.priced.offer.id === s.priced.offer.id)) return;
    chosen.push({
      ...s,
      angle,
      reasons: reasonsForCuratedAngle(s, angle, pool),
    });
  };

  // 1) Best overall (preference-aware rank).
  take(ranked[0], "best_value");

  // 2) Cheapest (if different from best overall).
  const byPrice = [...ranked].sort(
    (a, b) => a.priced.customerPrice.amount - b.priced.customerPrice.amount,
  );
  take(byPrice[0], "cheapest");

  // 3) Fastest for flights (PRD Module 1/4 — not premium).
  const flights = ranked.filter((s) => isFlight(s.priced.offer));
  const stays = ranked.filter((s) => !isFlight(s.priced.offer));
  if (flights.length) {
    const byDuration = [...flights].sort(
      (a, b) => totalJourneyMinutes(a.priced) - totalJourneyMinutes(b.priced),
    );
    take(byDuration[0], "fastest");
  } else if (stays.length) {
    const topRated = [...ranked].sort(
      (a, b) => scoreForRating(b) - scoreForRating(a),
    )[0];
    take(topRated, "top_rated");
  }

  // Do not backfill with "recommended" for the default top-3 — return fewer
  // meaningfully distinct angles rather than near-duplicates.
  if (n > 3) {
    for (const s of ranked) {
      if (chosen.length >= n) break;
      take(s, "recommended");
    }
  }

  return chosen.slice(0, n);
}

/**
 * Apply curated angles onto a ranked SERP list so the rail shows Best /
 * Cheapest / Fastest badges without inventing new offers.
 */
export function applyCuratedAngles(
  ranked: ScoredOffer[],
  curated: ScoredOffer[],
): ScoredOffer[] {
  if (curated.length === 0) return ranked;
  const byId = new Map(curated.map((c) => [c.priced.offer.id, c]));
  return ranked.map((s) => {
    const c = byId.get(s.priced.offer.id);
    return c ? { ...s, angle: c.angle, reasons: c.reasons, score: c.score } : s;
  });
}

function scoreForRating(s: ScoredOffer): number {
  const o = s.priced.offer;
  if (isHotel(o)) return o.ratingScore;
  if (isPackage(o)) return o.stars * 2;
  return 0;
}

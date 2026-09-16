/**
 * Module 04 learning loop — aggregate verified RecommendationFeedback into
 * bounded, explainable soft preferences.
 *
 * Precedence (highest → lowest):
 *   1. Explicit current chat intent
 *   2. Saved profile preferences
 *   3. Learned feedback weights
 *
 * Never invents quality/OTP/miles. One interaction cannot radically change ranking.
 */

export type RecommendationFeedbackSignal = "ACCEPT" | "REJECT" | "IGNORE";

/** Attributes present at feedback time — only real offer fields, never guessed. */
export type FeedbackOfferContext = {
  airlineCode?: string;
  stops?: number;
  refundable?: boolean;
};

export type FeedbackEvent = {
  signal: RecommendationFeedbackSignal;
  /** Offer attributes captured with the signal; omitted → event ignored for learning. */
  context?: FeedbackOfferContext | null;
};

export type LearnedPreferences = {
  /** Net airline lean scores after clamping (−MAX..+MAX). */
  airlineLean: Record<string, number>;
  /** Soft prefer refundable when enough ACCEPT signals on refundable offers. */
  preferRefundable: boolean;
  /** Soft prefer nonstop when enough ACCEPT signals on nonstop offers. */
  preferNonstop: boolean;
  /** Total feedback events that contributed (for explainability). */
  sampleCount: number;
};

/** Shared bounds — keep in sync with server `modules/recommendations/learning.js`. */
export const LEARNING_BOUNDS = {
  /** Minimum ACCEPT−REJECT net count before an airline lean applies. */
  minAirlineNet: 2,
  /** Score points added/subtracted per net ACCEPT (frontend 0–100 scale). */
  pointsPerNetAccept: 2,
  /** Absolute max airline lean contribution (points). */
  maxAirlineDelta: 8,
  /** Absolute max total learned contribution across all signals (points). */
  maxTotalLearnedDelta: 10,
  /** Soft refundable boost when preferRefundable (points). */
  refundableBoost: 3,
  /** Soft nonstop boost when preferNonstop (points). */
  nonstopBoost: 4,
  /** Min net ACCEPT−REJECT on refundable/nonstop before soft flag. */
  minTraitNet: 2,
} as const;

/** Server 0–1 scale equivalents (same ratios). */
export const LEARNING_BOUNDS_UNIT = {
  minAirlineNet: LEARNING_BOUNDS.minAirlineNet,
  weightPerNetAccept: 0.02,
  maxAirlineWeight: 0.08,
  maxTotalLearnedWeight: 0.1,
  refundableBoost: 0.03,
  nonstopBoost: 0.04,
  minTraitNet: LEARNING_BOUNDS.minTraitNet,
} as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function signalDelta(signal: RecommendationFeedbackSignal): number {
  if (signal === "ACCEPT") return 1;
  if (signal === "REJECT") return -1;
  return 0; // IGNORE does not train
}

/**
 * Aggregate user-scoped feedback events into bounded learned preferences.
 * Caller must already filter events to a single userId (isolation).
 */
export function aggregateLearnedPreferences(
  events: FeedbackEvent[],
): LearnedPreferences {
  const airlineNet: Record<string, number> = {};
  let refundableNet = 0;
  let nonstopNet = 0;
  let sampleCount = 0;

  for (const ev of events) {
    const ctx = ev.context;
    if (!ctx || typeof ctx !== "object") continue;
    const d = signalDelta(ev.signal);
    if (d === 0) continue;
    sampleCount += 1;

    const code =
      typeof ctx.airlineCode === "string" && ctx.airlineCode.trim()
        ? ctx.airlineCode.trim().toUpperCase().slice(0, 10)
        : null;
    if (code) {
      airlineNet[code] = (airlineNet[code] ?? 0) + d;
    }

    if (ctx.refundable === true) refundableNet += d;
    if (typeof ctx.stops === "number" && ctx.stops === 0) nonstopNet += d;
  }

  const airlineLean: Record<string, number> = {};
  for (const [code, net] of Object.entries(airlineNet)) {
    if (Math.abs(net) < LEARNING_BOUNDS.minAirlineNet) continue;
    const raw = net * LEARNING_BOUNDS.pointsPerNetAccept;
    airlineLean[code] = clamp(
      raw,
      -LEARNING_BOUNDS.maxAirlineDelta,
      LEARNING_BOUNDS.maxAirlineDelta,
    );
  }

  return {
    airlineLean,
    preferRefundable: refundableNet >= LEARNING_BOUNDS.minTraitNet,
    preferNonstop: nonstopNet >= LEARNING_BOUNDS.minTraitNet,
    sampleCount,
  };
}

export type LearnedOfferAttrs = {
  airlineCode?: string | null;
  airlineLabel?: string | null;
  stops?: number | null;
  refundable?: boolean | null;
};

export type LearnedApplyOptions = {
  /**
   * When true, chat/profile already set preferredAirlines — skip learned airline lean
   * (profile/chat outrank learned).
   */
  hasExplicitAirlinePreference?: boolean;
  /** When true, chat already forced nonstop — skip soft learned nonstop. */
  hasExplicitNonstopPreference?: boolean;
  /** When true, chat already required refundable — skip soft learned refundable. */
  hasExplicitRefundablePreference?: boolean;
};

export type LearnedBoostResult = {
  /** Frontend score points (−maxTotal..+maxTotal). */
  deltaPoints: number;
  /** Server 0–1 weight (−maxTotal..+maxTotal). */
  deltaWeight: number;
  reasons: string[];
};

/**
 * Compute bounded learned boost for one offer. Explainable reasons only when
 * a real lean actually contributed.
 */
export function computeLearnedBoost(
  offer: LearnedOfferAttrs,
  learned: LearnedPreferences | null | undefined,
  opts: LearnedApplyOptions = {},
): LearnedBoostResult {
  if (!learned || learned.sampleCount === 0) {
    return { deltaPoints: 0, deltaWeight: 0, reasons: [] };
  }

  let points = 0;
  let weight = 0;
  const reasons: string[] = [];

  if (!opts.hasExplicitAirlinePreference) {
    const code =
      (typeof offer.airlineCode === "string" && offer.airlineCode.trim()
        ? offer.airlineCode.trim().toUpperCase()
        : null) || null;
    // Match by IATA when available; label matching is caller's job via airlineCode.
    if (code && learned.airlineLean[code] != null) {
      const lean = learned.airlineLean[code];
      points += lean;
      weight += clamp(
        (lean / LEARNING_BOUNDS.pointsPerNetAccept) *
          LEARNING_BOUNDS_UNIT.weightPerNetAccept,
        -LEARNING_BOUNDS_UNIT.maxAirlineWeight,
        LEARNING_BOUNDS_UNIT.maxAirlineWeight,
      );
      if (lean > 0) {
        reasons.push(`Matches airlines you accepted before (${code})`);
      } else if (lean < 0) {
        reasons.push(`Similar to airlines you previously declined (${code})`);
      }
    }
  }

  if (
    learned.preferNonstop &&
    !opts.hasExplicitNonstopPreference &&
    offer.stops === 0
  ) {
    points += LEARNING_BOUNDS.nonstopBoost;
    weight += LEARNING_BOUNDS_UNIT.nonstopBoost;
    reasons.push("Matches nonstop trips you accepted before");
  }

  if (
    learned.preferRefundable &&
    !opts.hasExplicitRefundablePreference &&
    offer.refundable === true
  ) {
    points += LEARNING_BOUNDS.refundableBoost;
    weight += LEARNING_BOUNDS_UNIT.refundableBoost;
    reasons.push("Refundable — matches fares you accepted before");
  }

  return {
    deltaPoints: clamp(
      points,
      -LEARNING_BOUNDS.maxTotalLearnedDelta,
      LEARNING_BOUNDS.maxTotalLearnedDelta,
    ),
    deltaWeight: clamp(
      weight,
      -LEARNING_BOUNDS_UNIT.maxTotalLearnedWeight,
      LEARNING_BOUNDS_UNIT.maxTotalLearnedWeight,
    ),
    reasons,
  };
}

/** True when learned prefs object has any actionable signal. */
export function hasLearnedSignal(learned?: LearnedPreferences | null): boolean {
  if (!learned) return false;
  return (
    Object.keys(learned.airlineLean).length > 0 ||
    learned.preferRefundable ||
    learned.preferNonstop
  );
}

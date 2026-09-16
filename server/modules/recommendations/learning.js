/**
 * Module 04 learning loop — keep formulas in sync with
 * flight-one-main/lib/recommendation/learning.ts
 */
export const LEARNING_BOUNDS = {
  minAirlineNet: 2,
  pointsPerNetAccept: 2,
  maxAirlineDelta: 8,
  maxTotalLearnedDelta: 10,
  refundableBoost: 3,
  nonstopBoost: 4,
  minTraitNet: 2,
};

export const LEARNING_BOUNDS_UNIT = {
  minAirlineNet: LEARNING_BOUNDS.minAirlineNet,
  weightPerNetAccept: 0.02,
  maxAirlineWeight: 0.08,
  maxTotalLearnedWeight: 0.1,
  refundableBoost: 0.03,
  nonstopBoost: 0.04,
  minTraitNet: LEARNING_BOUNDS.minTraitNet,
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function signalDelta(signal) {
  if (signal === "ACCEPT") return 1;
  if (signal === "REJECT") return -1;
  return 0;
}

/**
 * Aggregate user-scoped feedback. Caller must filter to one userId.
 */
export function aggregateLearnedPreferences(events) {
  const airlineNet = {};
  let refundableNet = 0;
  let nonstopNet = 0;
  let sampleCount = 0;

  for (const ev of events ?? []) {
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

  const airlineLean = {};
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

export function computeLearnedBoost(offer, learned, opts = {}) {
  if (!learned || learned.sampleCount === 0) {
    return { deltaPoints: 0, deltaWeight: 0, reasons: [] };
  }

  let points = 0;
  let weight = 0;
  const reasons = [];

  if (!opts.hasExplicitAirlinePreference) {
    const code =
      typeof offer.airlineCode === "string" && offer.airlineCode.trim()
        ? offer.airlineCode.trim().toUpperCase()
        : null;
    if (code && learned.airlineLean[code] != null) {
      const lean = learned.airlineLean[code];
      points += lean;
      weight = (lean / LEARNING_BOUNDS.pointsPerNetAccept) * LEARNING_BOUNDS_UNIT.weightPerNetAccept;
      weight = clamp(
        weight,
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

  if (learned.preferNonstop && !opts.hasExplicitNonstopPreference && offer.stops === 0) {
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

export function hasLearnedSignal(learned) {
  if (!learned) return false;
  return (
    Object.keys(learned.airlineLean || {}).length > 0 ||
    learned.preferRefundable ||
    learned.preferNonstop
  );
}

/** Sanitize feedback context from request body — drop unknown/invented fields. */
export function sanitizeFeedbackContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  if (typeof raw.airlineCode === "string" && raw.airlineCode.trim()) {
    out.airlineCode = raw.airlineCode.trim().toUpperCase().slice(0, 10);
  }
  if (typeof raw.stops === "number" && Number.isFinite(raw.stops) && raw.stops >= 0) {
    out.stops = Math.min(9, Math.round(raw.stops));
  }
  if (typeof raw.refundable === "boolean") {
    out.refundable = raw.refundable;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Pure fare-prediction helpers. Never invent historical fares.
 * Observations must be real snapshot/booking amounts the caller already loaded.
 */

export const FARE_MIN_HISTORICAL_SAMPLES = 3;
export const FARE_RISE_RATIO = 1.08;
export const FARE_FALL_RATIO = 0.92;

export function median(values) {
  const nums = (values || []).filter((n) => Number.isInteger(n) && n >= 0).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}

export function daysUntilIsoDate(iso, now = new Date()) {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((d.getTime() - start) / 86400000);
}

export function confidenceFromSamples(count) {
  const n = Number.isInteger(count) ? count : 0;
  if (n < FARE_MIN_HISTORICAL_SAMPLES) return { level: "NONE", quality: "INSUFFICIENT", sampleCount: n };
  if (n <= 4) return { level: "LOW", quality: "LIMITED", sampleCount: n };
  if (n <= 8) return { level: "MEDIUM", quality: "MODERATE", sampleCount: n };
  return { level: "HIGH", quality: "STRONG", sampleCount: n };
}

/**
 * @param {{
 *   currentAmountMinor: number | null,
 *   currency: string | null,
 *   historicalAmounts: number[],
 *   daysUntilDepart: number | null,
 * }} input
 */
export function computeFareInsight({
  currentAmountMinor,
  currency,
  historicalAmounts = [],
  daysUntilDepart = null,
} = {}) {
  const current =
    Number.isInteger(currentAmountMinor) && currentAmountMinor >= 0 ? currentAmountMinor : null;
  const historical = (historicalAmounts || []).filter((n) => Number.isInteger(n) && n >= 0);
  const histMedian = median(historical);
  const confidence = confidenceFromSamples(historical.length);

  const currentFare = current == null
    ? { available: false, amountMinor: null, currency: currency || null, source: null }
    : {
        available: true,
        amountMinor: current,
        currency: currency || null,
        source: "verified_current",
      };

  if (!currentFare.available) {
    return {
      currentFare,
      prediction: {
        available: false,
        status: "INSUFFICIENT_DATA",
        trend: null,
        suggestedAction: "NOT_ENOUGH_DATA",
        confidence,
        historicalMedianMinor: histMedian,
        sampleCount: historical.length,
        explanation:
          "Not enough verified fare observations to suggest book-now versus wait. This is not a price guarantee.",
      },
    };
  }

  if (historical.length < FARE_MIN_HISTORICAL_SAMPLES || histMedian == null) {
    return {
      currentFare,
      prediction: {
        available: false,
        status: "INSUFFICIENT_DATA",
        trend: null,
        suggestedAction: "NOT_ENOUGH_DATA",
        confidence,
        historicalMedianMinor: histMedian,
        sampleCount: historical.length,
        explanation:
          "A current fare is available, but there are not enough prior observed fares on this route for a prediction. FlightOne will not invent historical prices.",
      },
    };
  }

  let trend = "STABLE";
  if (current > Math.round(histMedian * FARE_RISE_RATIO)) trend = "UP";
  else if (current < Math.round(histMedian * FARE_FALL_RATIO)) trend = "DOWN";

  let suggestedAction = "CONSIDER_WAIT";
  const reasons = [];
  reasons.push(
    `Based on ${historical.length} prior observed fares for this route, the median was lower or similar — this is an inference, not a guarantee.`,
  );

  if (daysUntilDepart != null && daysUntilDepart <= 7) {
    suggestedAction = "BOOK_NOW";
    reasons.unshift("Your travel date is close, so waiting has less room.");
  } else if (trend === "UP") {
    suggestedAction = "BOOK_NOW";
    reasons.unshift("The current observed fare is above your earlier observations for this route.");
  } else if (trend === "DOWN") {
    suggestedAction = "CONSIDER_WAIT";
    reasons.unshift("The current observed fare is below your earlier observations for this route.");
  } else if (daysUntilDepart != null && daysUntilDepart <= 21) {
    suggestedAction = "BOOK_NOW";
    reasons.unshift("Fares look similar to earlier observations and departure is within three weeks.");
  } else {
    suggestedAction = "CONSIDER_WAIT";
    reasons.unshift("Observed fares look similar to earlier checks — consider waiting only if your dates are flexible.");
  }

  return {
    currentFare,
    prediction: {
      available: true,
      status: "INFERENCE",
      trend,
      suggestedAction,
      confidence,
      historicalMedianMinor: histMedian,
      sampleCount: historical.length,
      explanation: `${reasons.join(" ")} This is not a guaranteed saving.`,
    },
  };
}

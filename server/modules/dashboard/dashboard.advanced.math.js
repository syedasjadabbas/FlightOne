/**
 * Phase 3 advanced analytics — pure helpers.
 * Never invents series values; callers supply verified observations.
 */
export const ANALYTICS_METHOD_CODE = "FO_ANALYTICS_V1";
export const ANALYTICS_METHOD_VERSION = "1.0";
export const ANALYTICS_METHOD_NOTE =
  "FlightOne FO_ANALYTICS_V1 — descriptive statistics over verified bookings. Forecasts and elasticity figures are inferences, not guarantees, and are not causal.";

export const FORECAST_MIN_PERIODS = 4;
export const ELASTICITY_MIN_OBS = 8;
export const ELASTICITY_MIN_PRICE_BUCKETS = 2;
export const SUPPLIER_INSIGHT_MIN_BOOKINGS = 5;
export const MAX_ANALYTICS_RANGE_DAYS = 366;
export const MAX_ANALYTICS_ROWS = 2500;

export function utcDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function weekStartUtc(value) {
  const d = utcDay(value);
  if (!d) return null;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function monthKeyUtc(value) {
  const d = utcDay(value);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function median(values) {
  const nums = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

export function mean(values) {
  const nums = (values || []).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stdev(values) {
  const nums = (values || []).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((acc, n) => acc + (n - m) * (n - m), 0) / (nums.length - 1);
  return Math.sqrt(v);
}

/**
 * Naive next-period forecast from weekly observation points.
 * Requires FORECAST_MIN_PERIODS weeks that contain at least one observation.
 */
export function forecastFromWeeklySeries(points, { metric = "volume" } = {}) {
  const series = (points || []).filter((p) => p && p.period && Number.isFinite(p.value));
  const observed = series.filter((p) => (p.observations || 0) > 0);
  const method = {
    code: ANALYTICS_METHOD_CODE,
    version: ANALYTICS_METHOD_VERSION,
    note: ANALYTICS_METHOD_NOTE,
    technique: "naive_last_plus_mean_delta",
  };
  if (observed.length < FORECAST_MIN_PERIODS) {
    return {
      available: false,
      status: "INSUFFICIENT_DATA",
      metric,
      sampleCount: observed.length,
      minRequired: FORECAST_MIN_PERIODS,
      forecast: null,
      range: null,
      series,
      method,
      explanation: `Not enough weekly observations (${observed.length}/${FORECAST_MIN_PERIODS}) to forecast ${metric}. FlightOne will not invent a trend.`,
    };
  }
  const values = observed.map((p) => p.value);
  const diffs = [];
  for (let i = 1; i < values.length; i += 1) diffs.push(values[i] - values[i - 1]);
  const last = values[values.length - 1];
  const drift = mean(diffs) || 0;
  const point = last + drift;
  const spread = stdev(values);
  const lo = Math.max(0, point - spread);
  const hi = Math.max(lo, point + spread);
  return {
    available: true,
    status: "INFERENCE",
    metric,
    sampleCount: observed.length,
    minRequired: FORECAST_MIN_PERIODS,
    forecast: Number(point.toFixed(2)),
    range: { low: Number(lo.toFixed(2)), high: Number(hi.toFixed(2)) },
    series: observed,
    method,
    explanation:
      "Next-period estimate is the last observed week plus the mean week-to-week change. This is not a guaranteed outcome.",
  };
}

/**
 * Observed price vs conversion association. Not a causal elasticity.
 */
export function observedPriceAssociation(rows) {
  const method = {
    code: ANALYTICS_METHOD_CODE,
    version: ANALYTICS_METHOD_VERSION,
    note: ANALYTICS_METHOD_NOTE,
    technique: "median_split_conversion_rates",
    causal: false,
    autoPriceChange: false,
  };
  const obs = (rows || []).filter((r) => Number.isInteger(r.priceMinor) && r.priceMinor >= 0);
  const prices = [...new Set(obs.map((r) => r.priceMinor))];
  if (obs.length < ELASTICITY_MIN_OBS || prices.length < ELASTICITY_MIN_PRICE_BUCKETS) {
    return {
      available: false,
      status: "INSUFFICIENT_DATA",
      kind: "OBSERVED_ASSOCIATION",
      causal: false,
      autoPriceChange: false,
      sampleCount: obs.length,
      distinctPrices: prices.length,
      method,
      explanation:
        "Not enough verified price/booking observations to estimate an association. FlightOne will not invent elasticity or change fares.",
    };
  }
  const med = median(obs.map((r) => r.priceMinor));
  const low = obs.filter((r) => r.priceMinor <= med);
  const high = obs.filter((r) => r.priceMinor > med);
  if (!high.length) {
    return {
      available: false,
      status: "INSUFFICIENT_DATA",
      kind: "OBSERVED_ASSOCIATION",
      causal: false,
      autoPriceChange: false,
      sampleCount: obs.length,
      distinctPrices: prices.length,
      method,
      explanation: "Observed prices do not vary enough above the median to compare conversion.",
    };
  }
  const rate = (list) => {
    const converted = list.filter((r) => r.converted).length;
    return list.length ? converted / list.length : null;
  };
  const rateLow = rate(low);
  const rateHigh = rate(high);
  let direction = "FLAT";
  if (rateHigh < rateLow - 0.02) direction = "NEGATIVE";
  else if (rateHigh > rateLow + 0.02) direction = "POSITIVE";
  const estimate =
    rateLow != null && rateHigh != null ? Number((((rateHigh - rateLow) / Math.max(0.01, rateLow || 0.01)) ).toFixed(4)) : null;
  return {
    available: true,
    status: "INFERENCE",
    kind: "OBSERVED_ASSOCIATION",
    causal: false,
    autoPriceChange: false,
    sampleCount: obs.length,
    distinctPrices: prices.length,
    medianPriceMinor: Math.round(med),
    conversionRateBelowMedian: rateLow == null ? null : Number(rateLow.toFixed(4)),
    conversionRateAboveMedian: rateHigh == null ? null : Number(rateHigh.toFixed(4)),
    direction,
    estimate,
    method,
    explanation:
      direction === "NEGATIVE"
        ? "Among these verified observations, conversion was lower above the median fare. This is an association, not a causal elasticity, and fares are not changed."
        : direction === "POSITIVE"
          ? "Among these verified observations, conversion was higher above the median fare. This is an association, not a causal elasticity."
          : "Conversion rates were similar above and below the median observed fare. Not a causal claim.",
  };
}

export function buildSupplierInsights(suppliers, { period } = {}) {
  const method = {
    code: ANALYTICS_METHOD_CODE,
    version: ANALYTICS_METHOD_VERSION,
    note: ANALYTICS_METHOD_NOTE,
    autoNegotiate: false,
  };
  const rows = (suppliers || []).filter((s) => s && s.bookings > 0);
  const total = rows.reduce((acc, s) => acc + s.bookings, 0);
  const insights = [];
  if (total < SUPPLIER_INSIGHT_MIN_BOOKINGS) {
    return {
      available: false,
      status: "INSUFFICIENT_DATA",
      insights: [],
      suppliers: rows,
      sampleCount: total,
      method,
      period: period || null,
      autoNegotiate: false,
      explanation: `Fewer than ${SUPPLIER_INSIGHT_MIN_BOOKINGS} verified supplier bookings in this period — no negotiation insight is offered.`,
    };
  }
  const ranked = [...rows].sort((a, b) => b.bookings - a.bookings);
  const leader = ranked[0];
  const share = leader.bookings / total;
  insights.push({
    kind: "SHARE",
    supplierCode: leader.supplierCode,
    body: `${leader.supplierCode} accounted for ${Math.round(share * 100)}% of verified bookings in this period (${leader.bookings}/${total}).`,
    bookings: leader.bookings,
    share: Number(share.toFixed(4)),
  });
  const highCancel = ranked.find(
    (s) => s.bookings >= SUPPLIER_INSIGHT_MIN_BOOKINGS && (s.cancelRefundRate || 0) >= 0.25,
  );
  if (highCancel) {
    insights.push({
      kind: "CANCEL_RATE",
      supplierCode: highCancel.supplierCode,
      body: `${highCancel.supplierCode} has an observed cancel/refund rate of ${Math.round((highCancel.cancelRefundRate || 0) * 100)}% on ${highCancel.bookings} bookings. Decision-support only — FlightOne will not contact the supplier.`,
      bookings: highCancel.bookings,
      cancelRefundRate: highCancel.cancelRefundRate,
    });
  }
  const concentrated = (leader.topRouteShare || 0) >= 0.6 && leader.bookings >= SUPPLIER_INSIGHT_MIN_BOOKINGS;
  if (concentrated && leader.topRoute) {
    insights.push({
      kind: "ROUTE_CONCENTRATION",
      supplierCode: leader.supplierCode,
      body: `${leader.supplierCode} volume is concentrated on ${leader.topRoute}. Useful context for negotiation, not a contract change.`,
      route: leader.topRoute,
    });
  }
  return {
    available: true,
    status: "OK",
    insights,
    suppliers: ranked,
    sampleCount: total,
    method,
    period: period || null,
    autoNegotiate: false,
    explanation: "Insights are counts and shares of verified bookings only. No supplier is contacted automatically.",
  };
}

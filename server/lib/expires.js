/** Parse env like "15m", "7d", "24h" to milliseconds */
export function parseDurationToMs(value, fallbackMs) {
  if (!value || typeof value !== "string") return fallbackMs;
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!m) return fallbackMs;
  const n = parseInt(m[1], 10);
  const u = m[2];
  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * mult[u];
}

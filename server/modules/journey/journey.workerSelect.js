/**
 * Pure helpers for JourneyWatch worker candidate selection (testable without DB).
 */
export function filterDueWatches(candidates, cooldownCutoff) {
  return (candidates || []).filter(
    (w) => !w.lastPolledAt || new Date(w.lastPolledAt) < cooldownCutoff,
  );
}

export function workerWindowCutoffs(now = new Date(), env = process.env) {
  const lookaheadMs = Number(env.JOURNEY_WORKER_LOOKAHEAD_MS) || 72 * 60 * 60 * 1000;
  const lookbehindMs = Number(env.JOURNEY_WORKER_LOOKBEHIND_MS) || 6 * 60 * 60 * 1000;
  const cooldownMs = Number(env.JOURNEY_WORKER_COOLDOWN_MS) || 5 * 60 * 1000;
  const t = now.getTime();
  return {
    cooldownCutoff: new Date(t - cooldownMs),
    lookaheadCutoff: new Date(t + lookaheadMs),
    lookbehindCutoff: new Date(t - lookbehindMs),
    cooldownMs,
    lookaheadMs,
    lookbehindMs,
  };
}

/**
 * Bounded concurrent map (same semantics as journey-monitor worker).
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
}

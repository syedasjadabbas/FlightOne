/**
 * Minimal in-memory stale-while-revalidate + single-flight cache.
 *
 * Mirrors `crm-server`'s `withReportCache` / `withDashboardSection` pattern
 * referenced by the dev guide (§6.4) — no shared package exists to import it
 * from here, so it's reimplemented locally per that guidance.
 *
 * - **TTL-based freshness**: an entry is served from memory until `ttlMs`
 *   elapses, then the next caller triggers a fresh compute.
 * - **Single-flight**: while a compute for a given key is in flight, every
 *   other caller for that *exact same key* awaits the same promise instead
 *   of firing a duplicate DB query — this matters a lot for a dashboard that
 *   fires several widgets at once, or a React double-mount re-request.
 * - **Cache key discipline is the caller's job.** Every query parameter that
 *   changes the result (date range, currency, product, company, …) MUST be
 *   encoded into the key. A missing param is a stale/wrong-number-on-a-
 *   dashboard bug, not a cosmetic one (dev guide §6.4).
 * - A failed compute is never cached — the entry is evicted so the next call
 *   retries instead of permanently serving an error.
 */

const DEFAULT_TTL_MS = 30 * 1000;

/** @type {Map<string, { value: any, expiresAt: number, inflight: Promise<any> | null }>} */
const store = new Map();

export function swrCacheSize() {
  return store.size;
}

export function clearSwrCache() {
  store.clear();
}

export function invalidateSwrCache(key) {
  store.delete(key);
}

/**
 * @param {string} key - cache key; MUST include every param that changes the result.
 * @param {number} ttlMs - freshness window in ms.
 * @param {() => Promise<any>} fn - the (expensive) compute function.
 * @returns {Promise<any>}
 */
export function withCache(key, ttlMs, fn) {
  const now = Date.now();
  const entry = store.get(key);

  if (entry) {
    if (entry.inflight) {
      // Single-flight: another caller is already computing this exact key —
      // share its result instead of starting a second identical compute.
      return entry.inflight;
    }
    if (entry.expiresAt > now) {
      return Promise.resolve(entry.value);
    }
  }

  const inflight = Promise.resolve()
    .then(fn)
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs, inflight: null });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { value: entry?.value, expiresAt: entry?.expiresAt ?? 0, inflight });
  return inflight;
}

/**
 * Module 17 (Management Dashboard) convenience wrapper — dev guide §6.4's
 * `withDashboardSection` naming. Defaults to a 30s TTL.
 *
 * Usage: `withDashboardSection(cacheKey, ttlMs, fn)` or, to accept the
 * default TTL, `withDashboardSection(cacheKey, fn)`.
 *
 * @param {string} cacheKey
 * @param {number | (() => Promise<any>)} ttlMsOrFn
 * @param {(() => Promise<any>) | undefined} [maybeFn]
 */
export function withDashboardSection(cacheKey, ttlMsOrFn, maybeFn) {
  const fn = typeof ttlMsOrFn === "function" ? ttlMsOrFn : maybeFn;
  const ttlMs = typeof ttlMsOrFn === "number" ? ttlMsOrFn : DEFAULT_TTL_MS;
  return withCache(`dashboard:${cacheKey}`, ttlMs, fn);
}

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request ambient store. Lets us memoize within a single request without
 * threading values through every function signature. The store is a Map that
 * lives only for the duration of one request, so there is zero added staleness.
 */
const storage = new AsyncLocalStorage();

/** Express middleware: establish a fresh per-request store. Mount early. */
export function requestContext(_req, _res, next) {
  storage.run(new Map(), () => next());
}

/**
 * Memoize an async value for the current request, keyed by `key`. Outside a
 * request context (scripts, workers) it just runs `compute` (no memo).
 */
export function memoizePerRequest(key, compute) {
  const store = storage.getStore();
  if (!store) return compute();
  if (store.has(key)) return store.get(key);
  const promise = Promise.resolve().then(compute);
  store.set(key, promise);
  return promise;
}

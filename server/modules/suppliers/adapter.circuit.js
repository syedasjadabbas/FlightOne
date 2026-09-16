/**
 * Supplier circuit breaker — process-local in-memory state.
 *
 * HONEST LIMIT: state is NOT shared across Node workers/processes/hosts.
 * Each process has its own OPEN/HALF_OPEN/CLOSED map. True distributed /
 * cluster-wide breakers require external shared infrastructure (e.g. Redis),
 * which this service deliberately does not depend on. Fail-closed semantics
 * still hold per process; PM2 `instances: 2` means each worker trips independently.
 *
 * Within a process:
 * - Concurrent failures increment safely via serialized Map updates.
 * - HALF_OPEN allows a single probe; other callers stay open until the
 *   probe succeeds (CLOSED) or fails (re-OPEN).
 */
import { AppError } from "../../lib/customError.js";

export const DEFAULT_SUPPLIER_TIMEOUT_MS = Number(process.env.SUPPLIER_TIMEOUT_MS) || 4000;

function circuitFailLimit() {
  const n = Number(process.env.SUPPLIER_CIRCUIT_FAIL_LIMIT);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
}

function circuitOpenMs() {
  const n = Number(process.env.SUPPLIER_CIRCUIT_OPEN_MS);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : 30_000;
}

/** @type {Map<string, { failures: number, openedAt: number | null, halfOpenProbeInFlight: boolean }>} */
const circuitState = new Map();

export function resetSupplierCircuitsForTests() {
  circuitState.clear();
}

export function getSupplierCircuitStateForTests(name) {
  const state = circuitState.get(name);
  if (!state) {
    return {
      failures: 0,
      openedAt: null,
      open: false,
      halfOpen: false,
      halfOpenProbeInFlight: false,
      scope: "process_local",
    };
  }
  const openMs = circuitOpenMs();
  const now = Date.now();
  const inCooldown = Boolean(state.openedAt && now - state.openedAt < openMs);
  const halfOpen = Boolean(state.openedAt && !inCooldown);
  return {
    failures: state.failures || 0,
    openedAt: state.openedAt || null,
    open: inCooldown,
    halfOpen,
    halfOpenProbeInFlight: Boolean(state.halfOpenProbeInFlight),
    scope: "process_local",
  };
}

function ensureState(name) {
  let state = circuitState.get(name);
  if (!state) {
    state = { failures: 0, openedAt: null, halfOpenProbeInFlight: false };
    circuitState.set(name, state);
  }
  return state;
}

function recordFailure(name, failLimit) {
  const prev = ensureState(name);
  prev.failures += 1;
  if (prev.failures >= failLimit) {
    prev.openedAt = Date.now();
  }
  prev.halfOpenProbeInFlight = false;
  circuitState.set(name, prev);
  return prev;
}

function openError(name, failLimit, openMs) {
  const err = new AppError(503, `${name} circuit open — supplier temporarily skipped`);
  err.code = "SUPPLIER_CIRCUIT_OPEN";
  err.details = { circuit: name, failLimit, openMs, scope: "process_local" };
  return err;
}

/**
 * @template T
 * @param {string} name Explicit per-operation key (e.g. TRAVELPORT_AIRPRICE).
 * @param {() => Promise<T>} fn
 * @param {{
 *   failLimit?: number,
 *   openMs?: number,
 *   isFailure?: (value: T) => boolean,
 *   onOpen?: "throw" | "return",
 *   openResult?: T | (() => T),
 * }} [opts]
 */
export async function withCircuitBreaker(name, fn, opts = {}) {
  const failLimit = opts.failLimit ?? circuitFailLimit();
  const openMs = opts.openMs ?? circuitOpenMs();
  const state = ensureState(name);
  const now = Date.now();

  if (state.openedAt && now - state.openedAt < openMs) {
    if (opts.onOpen === "return") {
      const openResult =
        typeof opts.openResult === "function" ? opts.openResult() : opts.openResult;
      return openResult;
    }
    throw openError(name, failLimit, openMs);
  }

  // Cooldown elapsed with prior open → HALF_OPEN: single probe only.
  const enteringHalfOpen = Boolean(state.openedAt);
  if (enteringHalfOpen) {
    if (state.halfOpenProbeInFlight) {
      if (opts.onOpen === "return") {
        const openResult =
          typeof opts.openResult === "function" ? opts.openResult() : opts.openResult;
        return openResult;
      }
      throw openError(name, failLimit, openMs);
    }
    state.halfOpenProbeInFlight = true;
  }

  try {
    const value = await fn();
    if (typeof opts.isFailure === "function" && opts.isFailure(value)) {
      recordFailure(name, failLimit);
      return value;
    }
    // Success closes the circuit.
    circuitState.delete(name);
    return value;
  } catch (err) {
    if (err?.code === "SUPPLIER_CIRCUIT_OPEN") throw err;
    recordFailure(name, failLimit);
    throw err;
  } finally {
    const current = circuitState.get(name);
    if (current) current.halfOpenProbeInFlight = false;
  }
}

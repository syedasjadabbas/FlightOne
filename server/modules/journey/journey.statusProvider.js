/**
 * Module 09 — live flight-status provider abstraction.
 *
 * Never fabricates delays, cancellations, gates, ETAs, or terminals.
 * Default: unconfigured → DATA_UNAVAILABLE / UNCONFIGURED.
 * Optional: JOURNEY_STATUS_PROVIDER=http + JOURNEY_STATUS_HTTP_URL.
 * Tests may inject a fetcher via setStatusFetcherForTests (NODE_ENV=test only).
 */
export const JOURNEY_STATUS_STALE_DEFAULT_MS = 30 * 60 * 1000; // 30m

/** @type {null | ((query: object) => Promise<object>)} */
let testFetcher = null;

export function getJourneyStatusProviderName(env = process.env) {
  return (env.JOURNEY_STATUS_PROVIDER || "unconfigured").trim().toLowerCase();
}

export function getJourneyStatusStaleAfterMs(env = process.env) {
  const n = Number(env.JOURNEY_STATUS_STALE_AFTER_MS);
  if (!Number.isFinite(n) || n < 1_000) return JOURNEY_STATUS_STALE_DEFAULT_MS;
  return Math.min(Math.floor(n), 24 * 60 * 60 * 1000);
}

/**
 * @returns {{
 *   provider: string,
 *   configured: boolean,
 *   canPollLive: boolean,
 *   sourceKind: string,
 *   staleAfterMs: number,
 *   reasons: string[],
 *   deferredFeeds: string[],
 * }}
 */
/**
 * Map observation freshness to fail-closed dataStatus.
 * Missing/invalid observedAt → DATA_UNAVAILABLE (never invent VERIFIED).
 */
export function statusFromFreshness(freshness, { snapshot = null, staleReason = null } = {}) {
  if (freshness === "VERIFIED") {
    return { dataStatus: "VERIFIED", isFact: true, snapshot, reason: null };
  }
  if (freshness === "STALE") {
    return {
      dataStatus: "STALE",
      isFact: false,
      snapshot,
      reason: staleReason || "Status observation is stale — do not present as guaranteed current",
    };
  }
  return {
    dataStatus: "DATA_UNAVAILABLE",
    isFact: false,
    snapshot: null,
    reason: "Provider omitted a valid observedAt — not treated as live fact",
  };
}

export function getJourneyStatusCapability(env = process.env) {
  const provider = getJourneyStatusProviderName(env);
  const staleAfterMs = getJourneyStatusStaleAfterMs(env);
  // Ancillary feeds are implemented separately (see getAncillaryCapabilities) —
  // do not advertise them as deferred here.
  const deferredFeeds = [];

  if (provider === "unconfigured" || provider === "none") {
    return {
      provider: "unconfigured",
      configured: false,
      canPollLive: false,
      sourceKind: "none",
      staleAfterMs,
      reasons: [
        "Live flight-status provider is unconfigured — set JOURNEY_STATUS_PROVIDER=http with JOURNEY_STATUS_HTTP_URL",
      ],
      deferredFeeds,
    };
  }

  if (provider === "http") {
    const url = env.JOURNEY_STATUS_HTTP_URL?.trim();
    if (!url) {
      return {
        provider: "http_misconfigured",
        configured: false,
        canPollLive: false,
        sourceKind: "http",
        staleAfterMs,
        reasons: ["JOURNEY_STATUS_HTTP_URL is required when JOURNEY_STATUS_PROVIDER=http"],
        deferredFeeds,
      };
    }
    return {
      provider: "http",
      configured: true,
      canPollLive: true,
      sourceKind: "external_http",
      staleAfterMs,
      reasons: [],
      deferredFeeds,
    };
  }

  return {
    provider: "unknown",
    configured: false,
    canPollLive: false,
    sourceKind: "none",
    staleAfterMs,
    reasons: [`Unknown JOURNEY_STATUS_PROVIDER=${provider}`],
    deferredFeeds,
  };
}

/**
 * Normalize a provider payload into a safe status snapshot.
 * Missing fields stay null — never invent gates/ETAs.
 */
export function normalizeFlightStatusPayload(raw, { flightNumber, departAt } = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  // Never invent observation time — missing observedAt stays null (fail-closed freshness).
  const observedRaw = src.observedAt ? new Date(src.observedAt) : null;
  const observedAt =
    observedRaw && !Number.isNaN(observedRaw.getTime()) ? observedRaw.toISOString() : null;
  const status = typeof src.status === "string" ? src.status.trim().toUpperCase() : "UNKNOWN";
  const allowed = new Set([
    "SCHEDULED",
    "DELAYED",
    "CANCELLED",
    "BOARDING",
    "DEPARTED",
    "ARRIVED",
    "DIVERTED",
    "UNKNOWN",
  ]);
  const normalizedStatus = allowed.has(status) ? status : "UNKNOWN";

  const minutesDelayed =
    Number.isInteger(src.minutesDelayed) && src.minutesDelayed >= 0
      ? src.minutesDelayed
      : null;

  return {
    flightNumber: src.flightNumber || flightNumber || null,
    status: normalizedStatus,
    minutesDelayed,
    scheduledDepartAt: src.scheduledDepartAt || (departAt ? new Date(departAt).toISOString() : null),
    estimatedDepartAt: src.estimatedDepartAt || null,
    scheduledArriveAt: src.scheduledArriveAt || null,
    estimatedArriveAt: src.estimatedArriveAt || null,
    gate: typeof src.gate === "string" ? src.gate.trim() || null : null,
    terminal: typeof src.terminal === "string" ? src.terminal.trim() || null : null,
    origin: src.origin || null,
    destination: src.destination || null,
    observedAt,
    source: typeof src.source === "string" ? src.source : null,
  };
}

function classifyFreshness(observedAtIso, staleAfterMs) {
  if (!observedAtIso) return "UNKNOWN";
  const age = Date.now() - new Date(observedAtIso).getTime();
  if (!Number.isFinite(age) || age < 0) return "UNKNOWN";
  return age > staleAfterMs ? "STALE" : "VERIFIED";
}

/**
 * @returns {Promise<{
 *   dataStatus: 'VERIFIED'|'STALE'|'DATA_UNAVAILABLE'|'UNCONFIGURED'|'PROVIDER_ERROR'|'INCOMPLETE_INPUTS',
 *   isFact: boolean,
 *   snapshot: object|null,
 *   reason: string|null,
 * }>}
 */
export async function fetchFlightStatus(query = {}, env = process.env) {
  const capability = getJourneyStatusCapability(env);
  const flightNumber = query.flightNumber ? String(query.flightNumber).trim() : null;
  if (!flightNumber) {
    return {
      dataStatus: "INCOMPLETE_INPUTS",
      isFact: false,
      snapshot: null,
      reason: "flightNumber is required for live status lookup",
    };
  }

  if (typeof testFetcher === "function" && env.NODE_ENV === "test") {
    try {
      const raw = await testFetcher(query);
      if (!raw) {
        return {
          dataStatus: "DATA_UNAVAILABLE",
          isFact: false,
          snapshot: null,
          reason: "Test fetcher returned no status",
        };
      }
      const snapshot = normalizeFlightStatusPayload(raw, query);
      const freshness = classifyFreshness(snapshot.observedAt, capability.staleAfterMs);
      return statusFromFreshness(freshness, {
        snapshot,
        staleReason: "Status observation is stale",
      });
    } catch (e) {
      return {
        dataStatus: "PROVIDER_ERROR",
        isFact: false,
        snapshot: null,
        reason: e?.message || "Test fetcher failed",
      };
    }
  }

  if (!capability.canPollLive) {
    return {
      dataStatus: capability.provider === "unconfigured" ? "UNCONFIGURED" : "DATA_UNAVAILABLE",
      isFact: false,
      snapshot: null,
      reason: capability.reasons[0] || "Live flight status unavailable",
    };
  }

  const url = env.JOURNEY_STATUS_HTTP_URL?.trim();
  const timeoutMs = Number(env.JOURNEY_STATUS_HTTP_TIMEOUT_MS) || 12_000;
  const apiKey = env.JOURNEY_STATUS_HTTP_API_KEY?.trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = new URL(url);
    endpoint.searchParams.set("flightNumber", flightNumber);
    if (query.departAt) endpoint.searchParams.set("departAt", new Date(query.departAt).toISOString());
    if (query.origin) endpoint.searchParams.set("origin", String(query.origin));
    if (query.destination) endpoint.searchParams.set("destination", String(query.destination));

    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.status === 404) {
      return {
        dataStatus: "DATA_UNAVAILABLE",
        isFact: false,
        snapshot: null,
        reason: "Provider has no status for this flight",
      };
    }
    if (!res.ok) {
      return {
        dataStatus: "PROVIDER_ERROR",
        isFact: false,
        snapshot: null,
        reason: `Provider HTTP ${res.status}`,
      };
    }

    const body = await res.json();
    const raw = body?.data && typeof body.data === "object" ? body.data : body;
    if (!raw || typeof raw !== "object") {
      return {
        dataStatus: "DATA_UNAVAILABLE",
        isFact: false,
        snapshot: null,
        reason: "Provider returned empty status payload",
      };
    }

    const snapshot = normalizeFlightStatusPayload(raw, query);
    const freshness = classifyFreshness(snapshot.observedAt, capability.staleAfterMs);
    return statusFromFreshness(freshness, {
      snapshot,
      staleReason: "Status observation is stale — do not present as guaranteed current",
    });
  } catch (e) {
    return {
      dataStatus: "PROVIDER_ERROR",
      isFact: false,
      snapshot: null,
      reason: e?.name === "AbortError" ? "Provider timeout" : e?.message || "Provider request failed",
    };
  }
}

/** Test-only injector. Cleared after each suite. */
export function setStatusFetcherForTests(fn) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setStatusFetcherForTests is only allowed when NODE_ENV=test");
  }
  testFetcher = typeof fn === "function" ? fn : null;
}

export function resetStatusFetcherForTests() {
  testFetcher = null;
}

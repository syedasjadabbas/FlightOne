/**
 * Module 12 — MICE transfer provider boundary.
 *
 * Booking/confirmation: MICE_TRANSFER_BOOK_PROVIDER=http + MICE_TRANSFER_BOOK_HTTP_URL.
 * Live status (optional): reuses Module 09 JOURNEY_TRANSFER_STATUS_* fail-closed adapter.
 *
 * Never fabricates vehicles, prices, drivers, availability, or confirmation refs.
 */
import {
  fetchTransferStatus,
  getTransferStatusCapability,
} from "../journey/journey.ancillaryProviders.js";

/** @type {null | ((payload: object) => Promise<object|null>)} */
let testBookFetcher = null;

export function getMiceTransferBookProviderName(env = process.env) {
  return (env.MICE_TRANSFER_BOOK_PROVIDER || "unconfigured").trim().toLowerCase();
}

/**
 * @returns {{
 *   provider: string,
 *   configured: boolean,
 *   canBookLive: boolean,
 *   sourceKind: string,
 *   reasons: string[],
 *   liveStatus: ReturnType<typeof getTransferStatusCapability>,
 * }}
 */
export function getMiceTransferCapability(env = process.env) {
  const provider = getMiceTransferBookProviderName(env);
  const liveStatus = getTransferStatusCapability(env);
  const reasons = [];

  if (provider === "unconfigured" || provider === "none") {
    reasons.push(
      "MICE transfer booking provider is unconfigured — set MICE_TRANSFER_BOOK_PROVIDER=http with MICE_TRANSFER_BOOK_HTTP_URL",
    );
    return {
      provider: "unconfigured",
      configured: false,
      canBookLive: false,
      sourceKind: "none",
      reasons,
      liveStatus,
    };
  }

  if (provider === "http") {
    const url = env.MICE_TRANSFER_BOOK_HTTP_URL?.trim();
    if (!url) {
      reasons.push("MICE_TRANSFER_BOOK_HTTP_URL is required when MICE_TRANSFER_BOOK_PROVIDER=http");
      return {
        provider: "http_misconfigured",
        configured: false,
        canBookLive: false,
        sourceKind: "http",
        reasons,
        liveStatus,
      };
    }
    return {
      provider: "http",
      configured: true,
      canBookLive: true,
      sourceKind: "external_http",
      reasons: [],
      liveStatus,
    };
  }

  reasons.push(`Unknown MICE_TRANSFER_BOOK_PROVIDER=${provider}`);
  return {
    provider: "unknown",
    configured: false,
    canBookLive: false,
    sourceKind: "none",
    reasons,
    liveStatus,
  };
}

/**
 * Attempt live transfer booking. CONFIRMED only when provider returns confirmationRef.
 * @returns {Promise<{
 *   ok: boolean,
 *   status: 'CONFIRMED'|'PROVIDER_UNCONFIGURED'|'DATA_UNAVAILABLE'|'FAILED',
 *   transferRef: string|null,
 *   providerStatus: string|null,
 *   reason: string|null,
 *   raw?: object|null,
 * }>}
 */
export async function attemptMiceTransferBooking(transferPayload, env = process.env) {
  const capability = getMiceTransferCapability(env);

  if (typeof testBookFetcher === "function" && env.NODE_ENV === "test") {
    try {
      const raw = await testBookFetcher(transferPayload);
      if (!raw || typeof raw !== "object") {
        return {
          ok: false,
          status: "DATA_UNAVAILABLE",
          transferRef: null,
          providerStatus: "DATA_UNAVAILABLE",
          reason: "Test transfer book fetcher returned empty",
          raw: null,
        };
      }
      const confirmationRef =
        typeof raw.confirmationRef === "string" && raw.confirmationRef.trim()
          ? raw.confirmationRef.trim()
          : typeof raw.transferRef === "string" && raw.transferRef.trim()
            ? raw.transferRef.trim()
            : null;
      if (!confirmationRef) {
        return {
          ok: false,
          status: "DATA_UNAVAILABLE",
          transferRef: null,
          providerStatus: "DATA_UNAVAILABLE",
          reason: "Provider response lacked confirmationRef — not marked CONFIRMED",
          raw,
        };
      }
      if (raw.declined === true || raw.status === "FAILED") {
        return {
          ok: false,
          status: "FAILED",
          transferRef: null,
          providerStatus: "FAILED",
          reason: raw.reason || "Provider declined transfer booking",
          raw,
        };
      }
      return {
        ok: true,
        status: "CONFIRMED",
        transferRef: confirmationRef,
        providerStatus: "CONFIRMED",
        reason: null,
        raw,
      };
    } catch (e) {
      return {
        ok: false,
        status: "FAILED",
        transferRef: null,
        providerStatus: "PROVIDER_ERROR",
        reason: e?.message || "Test transfer book fetcher failed",
        raw: null,
      };
    }
  }

  if (!capability.canBookLive) {
    return {
      ok: false,
      status: "PROVIDER_UNCONFIGURED",
      transferRef: null,
      providerStatus: capability.provider,
      reason: capability.reasons[0] || "Transfer booking provider unconfigured",
      raw: null,
    };
  }

  const url = env.MICE_TRANSFER_BOOK_HTTP_URL?.trim();
  const timeoutMs = Number(env.MICE_TRANSFER_BOOK_HTTP_TIMEOUT_MS) || 15_000;
  const apiKey =
    env.MICE_TRANSFER_BOOK_HTTP_API_KEY?.trim() ||
    env.JOURNEY_ANCILLARY_HTTP_API_KEY?.trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(transferPayload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.status === 404) {
      return {
        ok: false,
        status: "DATA_UNAVAILABLE",
        transferRef: null,
        providerStatus: "HTTP_404",
        reason: "Transfer provider has no inventory for this request",
        raw: null,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "FAILED",
        transferRef: null,
        providerStatus: `HTTP_${res.status}`,
        reason: `Transfer provider HTTP ${res.status}`,
        raw: null,
      };
    }

    const body = await res.json();
    const raw = body?.data && typeof body.data === "object" ? body.data : body;
    const confirmationRef =
      typeof raw?.confirmationRef === "string" && raw.confirmationRef.trim()
        ? raw.confirmationRef.trim()
        : typeof raw?.transferRef === "string" && raw.transferRef.trim()
          ? raw.transferRef.trim()
          : null;
    if (!confirmationRef) {
      return {
        ok: false,
        status: "DATA_UNAVAILABLE",
        transferRef: null,
        providerStatus: "DATA_UNAVAILABLE",
        reason: "Provider response lacked confirmationRef — not marked CONFIRMED",
        raw: raw && typeof raw === "object" ? raw : null,
      };
    }
    return {
      ok: true,
      status: "CONFIRMED",
      transferRef: confirmationRef,
      providerStatus: "CONFIRMED",
      reason: null,
      raw: raw && typeof raw === "object" ? raw : null,
    };
  } catch (e) {
    return {
      ok: false,
      status: "FAILED",
      transferRef: null,
      providerStatus: "PROVIDER_ERROR",
      reason: e?.name === "AbortError" ? "Transfer provider timeout" : e?.message || "Provider request failed",
      raw: null,
    };
  }
}

/**
 * Optional live transfer status via Module 09 adapter (fail-closed).
 */
export async function fetchMiceTransferLiveStatus(query = {}, env = process.env) {
  return fetchTransferStatus(query, env);
}

export function setMiceTransferBookFetcherForTests(fn) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setMiceTransferBookFetcherForTests only allowed when NODE_ENV=test");
  }
  testBookFetcher = typeof fn === "function" ? fn : null;
}

export function resetMiceTransferBookFetcherForTests() {
  testBookFetcher = null;
}

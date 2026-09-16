/**
 * Shared TripServices HTTP helper (Flights + Stays).
 */
import { AppError } from "../../../lib/customError.js";
import { getAccessToken } from "./auth.js";
import { travelportConfig } from "./config.js";

/**
 * @param {string} path  Path under the chosen base, e.g. "/catalog/search/..."
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   traceId?: string,
 *   baseUrl?: string,
 *   acceptVersion?: string,
 *   contentVersion?: string,
 * }} [opts]
 */
export async function travelportFetch(path, opts = {}) {
  const cfg = travelportConfig();
  const token = await getAccessToken();
  const method = opts.method || "POST";
  const base = (opts.baseUrl || cfg.airBaseUrl).replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    Authorization: `Bearer ${token}`,
    "Accept-Version": opts.acceptVersion || cfg.acceptVersion,
    "Content-Version": opts.contentVersion || cfg.contentVersion,
  };

  if (cfg.accessGroup) {
    headers.XAUTH_TRAVELPORT_ACCESSGROUP = cfg.accessGroup;
  }
  if (cfg.pccCore) {
    headers["TVP-PCC-CORE"] = cfg.pccCore;
  }
  if (opts.traceId) {
    headers.TraceId = String(opts.traceId);
  }

  const init = {
    method,
    headers,
    signal: AbortSignal.timeout(cfg.timeoutMs),
  };

  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new AppError(504, `Travelport ${path} timed out`);
    }
    throw new AppError(502, `Travelport ${path} failed: ${e?.message || "network error"}`);
  }

  const e2e = res.headers.get("e2etrackingid") || res.headers.get("E2ETrackingId") || null;
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (opts.allowHttpError) {
        return { json: null, e2eTrackingId: e2e, status: res.status, raw: text };
      }
      throw new AppError(
        502,
        `Travelport ${path} returned non-JSON (HTTP ${res.status}${e2e ? `; e2e=${e2e}` : ""})`,
      );
    }
  }

  if (!res.ok) {
    const msg =
      json?.CatalogProductOfferingsResponse?.Result?.Error?.[0]?.Message ||
      json?.Result?.Error?.[0]?.Message ||
      json?.errors?.[0]?.message ||
      json?.message ||
      `Travelport ${path} HTTP ${res.status}`;
    if (opts.allowHttpError) {
      return { json, e2eTrackingId: e2e, status: res.status, error: msg };
    }
    throw new AppError(502, e2e ? `${msg} (e2e=${e2e})` : msg);
  }

  return { json, e2eTrackingId: e2e, status: res.status };
}

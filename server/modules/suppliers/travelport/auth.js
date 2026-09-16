/**
 * OAuth token cache for TripServices.
 * Certification requires ~one token per 24h — never mint per request.
 *
 * Travelport docs: grant_type=password + username/password/client_id/client_secret.
 * Some Postman collections also send HTTP Basic (client_id:client_secret).
 */
import { AppError } from "../../../lib/customError.js";
import { travelportConfig } from "./config.js";

/** @type {{ token: string, expiresAtMs: number } | null} */
let cached = null;

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function clearTravelportTokenCache() {
  cached = null;
}

/**
 * @returns {Promise<string>} Bearer access token
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cached && cached.expiresAtMs - REFRESH_SKEW_MS > now) {
    return cached.token;
  }

  const cfg = travelportConfig();
  const attempts = [
    { name: "form+basic", useBasic: true, json: false },
    { name: "form", useBasic: false, json: false },
    { name: "json+basic", useBasic: true, json: true },
    { name: "json", useBasic: false, json: true },
  ];

  /** @type {string[]} */
  const errors = [];

  for (const attempt of attempts) {
    try {
      const tokenPayload = await requestToken(cfg, attempt);
      const expiresInSec = Number(tokenPayload.expires_in) || 86400;
      cached = {
        token: tokenPayload.access_token,
        expiresAtMs: now + expiresInSec * 1000,
      };
      if (process.env.TRAVELPORT_AUTH_DEBUG === "1") {
        console.info(`[travelport-auth] ok via ${attempt.name}`);
      }
      return cached.token;
    } catch (e) {
      errors.push(`${attempt.name}: ${e?.message || e}`);
    }
  }

  throw new AppError(502, `Travelport auth failed (${errors.join(" | ")})`);
}

/**
 * @param {ReturnType<typeof travelportConfig>} cfg
 * @param {{ useBasic: boolean, json: boolean }} mode
 */
async function requestToken(cfg, mode) {
  /** @type {Record<string, string>} */
  const headers = { Accept: "application/json" };
  if (mode.useBasic) {
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  let body;
  if (mode.json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      grant_type: "password",
      username: cfg.username,
      password: cfg.password,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams({
      grant_type: "password",
      username: cfg.username,
      password: cfg.password,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
    body = params;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  let res;
  try {
    res = await fetch(cfg.authUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw new Error(e?.message || "network error");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`HTTP ${res.status} non-JSON`);
  }

  if (!res.ok) {
    const detail = json?.error_description || json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }

  const token = json?.access_token;
  if (!token || typeof token !== "string") {
    throw new Error("missing access_token");
  }
  return json;
}

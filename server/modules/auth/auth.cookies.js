/**
 * HttpOnly refresh-cookie helpers (Module 00 production hardening).
 *
 * Design:
 * - `fo_refresh` is HttpOnly and never readable by frontend JS.
 * - Cookie Path is scoped to `/api/v1/auth` so it is only sent on auth endpoints.
 * - Cross-origin SPAs (Next :3000 → API :8084) need SameSite=None; Secure in production.
 * - CSRF for cookie-authenticated POSTs: require an allowed Origin/Referer OR the
 *   custom header `X-FlightOne-CSRF` (simple cross-site forms cannot set it; CORS
 *   only allows the configured frontend origin to make credentialed XHR).
 */
import { AppError } from "../../lib/customError.js";

export const REFRESH_COOKIE_NAME = "fo_refresh";
export const CSRF_HEADER_NAME = "x-flightone-csrf";

function parseCorsOrigins(env = process.env) {
  const raw = env.CORS_ORIGIN?.trim();
  if (!raw || raw === "*") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function refreshCookieOptions(env = process.env) {
  const secure =
    env.COOKIE_SECURE === "true" ||
    (env.COOKIE_SECURE !== "false" && env.NODE_ENV === "production");
  const sameSiteEnv = (env.COOKIE_SAME_SITE || "").toLowerCase();
  let sameSite = sameSiteEnv === "none" || sameSiteEnv === "lax" || sameSiteEnv === "strict"
    ? sameSiteEnv
    : secure
      ? "none"
      : "lax";
  // Browsers reject SameSite=None without Secure.
  // Production defaults (COOKIE_* unset): secure=true, sameSite=none for cross-origin SPA.
  // Development defaults: secure=false, sameSite=lax (works on http://localhost).
  if (sameSite === "none" && !secure) sameSite = "lax";

  // Express's `res.cookie()` treats `maxAge` as MILLISECONDS (it does
  // `Math.floor(maxAge / 1000)` internally to build the Max-Age attribute) —
  // the opposite convention from the raw `cookie` package's `serialize()`,
  // which takes seconds directly. Passing seconds here silently produces a
  // cookie ~1000x shorter than intended (e.g. 7 days becomes ~10 minutes).
  const maxAgeMs = (() => {
    const days = Number(env.JWT_REFRESH_COOKIE_MAX_AGE_DAYS);
    if (Number.isFinite(days) && days > 0) return Math.floor(days * 86400 * 1000);
    return 7 * 86400 * 1000;
  })();

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api/v1/auth",
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(res, refreshToken, env = process.env) {
  if (!res || typeof refreshToken !== "string" || !refreshToken) return;
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(env));
}

export function clearRefreshCookie(res, env = process.env) {
  if (!res) return;
  const opts = refreshCookieOptions(env);
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: opts.path,
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
  });
}

/** Prefer HttpOnly cookie; body/header only as explicit fallback (tests / non-browser). */
export function readRefreshTokenFromRequest(req) {
  const fromCookie = req?.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.trim()) return fromCookie.trim();

  const fromBody = req?.body?.refreshToken;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();

  const fromHeader = req?.headers?.["x-refresh-token"];
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim();

  return null;
}

function isAllowedDevOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * CSRF gate for cookie-based session mutation.
 * Skipped when the refresh token is supplied via body/header (non-cookie clients).
 */
export function assertCookieAuthRequestAllowed(req, { usedCookie } = {}) {
  if (!usedCookie) return;

  const header = String(req.headers?.[CSRF_HEADER_NAME] || "").trim();
  if (header) return;

  const allowed = parseCorsOrigins();
  const origin = String(req.headers?.origin || "").trim();
  if (
    origin &&
    (allowed.length === 0 ||
      allowed.includes(origin) ||
      (process.env.NODE_ENV !== "production" && isAllowedDevOrigin(origin)))
  ) {
    return;
  }

  const referer = String(req.headers?.referer || "").trim();
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (
        allowed.length === 0 ||
        allowed.includes(refOrigin) ||
        (process.env.NODE_ENV !== "production" && isAllowedDevOrigin(refOrigin))
      ) {
        return;
      }
    } catch {
      /* ignore */
    }
  }

  // Same-origin / missing Origin (some clients): allow only when CORS is unset
  // and there is no spoofable cross-site signal — still require CSRF header in prod.
  if (process.env.NODE_ENV !== "production" && !origin && !referer) return;

  throw new AppError(403, "CSRF validation failed for cookie session");
}

/** Whether JSON responses may still include refreshToken (tests / legacy clients). */
export function shouldReturnRefreshInBody(env = process.env) {
  if (env.AUTH_RETURN_REFRESH_IN_BODY === "true") return true;
  if (env.AUTH_RETURN_REFRESH_IN_BODY === "false") return false;
  return env.NODE_ENV === "test";
}

export function publicAuthSession(session, env = process.env) {
  if (!session) return session;
  if (shouldReturnRefreshInBody(env)) return session;
  const { refreshToken: _omit, ...rest } = session;
  return rest;
}

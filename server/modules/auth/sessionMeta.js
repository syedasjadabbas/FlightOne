/**
 * Safe device/session display helpers (Module 00).
 * Never parse secrets — only truncated User-Agent strings.
 */

const MAX_UA = 256;
const MAX_IP = 64;

export function sanitizeUserAgent(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_UA);
}

export function sanitizeIp(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Strip IPv6 zone id / surrounding brackets if present.
  const cleaned = trimmed.replace(/^\[|\]$/g, "").split("%")[0];
  return cleaned.slice(0, MAX_IP);
}

/** Coarse browser/OS label for UI — not a fingerprint. */
export function summarizeUserAgent(ua) {
  if (!ua || typeof ua !== "string") return "Unknown device";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}

export function captureSessionClientMeta(req) {
  if (!req) return { userAgent: null, ip: null };
  const ua =
    typeof req.get === "function"
      ? req.get("user-agent")
      : req.headers?.["user-agent"];
  const ip =
    req.ip ||
    req.socket?.remoteAddress ||
    (typeof req.get === "function" ? req.get("x-forwarded-for") : null);
  const firstIp =
    typeof ip === "string" && ip.includes(",") ? ip.split(",")[0].trim() : ip;
  return {
    userAgent: sanitizeUserAgent(ua),
    ip: sanitizeIp(firstIp),
  };
}

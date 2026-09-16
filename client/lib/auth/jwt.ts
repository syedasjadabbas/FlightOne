/**
 * Client-side JWT decoding — Module 00 (Foundation & Security).
 *
 * This ONLY reads the `exp` claim to answer "does this look expired?" for
 * `proxy.ts` and the auth store. It never verifies the signature — the
 * server (`filght-one-server`) is the sole authority on token validity; a
 * client-side check is UX only (fast redirect), never a security boundary.
 *
 * Uses `atob`/`TextDecoder`, both available on Node's `proxy.ts` runtime
 * (Node.js 20.9+, per AGENTS.md) and in every supported browser — no extra
 * dependency needed for a decode-only job.
 */

export interface DecodedJwt {
  exp?: number;
  iat?: number;
  sub?: string;
  [claim: string]: unknown;
}

function base64UrlToBytes(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Decodes a JWT's payload (middle segment). Returns `null` on any malformed input. */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    return JSON.parse(json) as DecodedJwt;
  } catch {
    return null;
  }
}

/** Milliseconds-since-epoch the token expires at, or `null` if undecodable/no `exp`. */
export function getJwtExpiryMs(token: string): number | null {
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return null;
  return decoded.exp * 1000;
}

/**
 * True if the token is missing, malformed, or expired (optionally with a
 * `skewMs` safety margin so a token about to expire mid-request is treated
 * as expired now, rather than after the fact).
 */
export function isJwtExpired(token: string | null | undefined, skewMs = 0): boolean {
  if (!token) return true;
  const expiryMs = getJwtExpiryMs(token);
  if (expiryMs === null) return true;
  return Date.now() + skewMs >= expiryMs;
}

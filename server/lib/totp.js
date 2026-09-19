/**
 * RFC 6238 TOTP (Time-Based One-Time Password) and RFC 4226 HOTP implementation.
 * Zero external dependencies — built using standard node:crypto.
 *
 * Strictly according to SDS M00, Appendix E (NFR-SEC-03, AUTH-05, UF-00.8).
 */
import crypto from "node:crypto";
import { sha256Hex } from "./crypto.js";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encode a Buffer into RFC 4648 Base32 string (unpadded).
 * @param {Buffer} buffer
 * @returns {string}
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decode an RFC 4648 Base32 string into a Buffer.
 * Ignores whitespace, hyphens, and is case-insensitive.
 * @param {string} str
 * @returns {Buffer}
 */
export function base32Decode(str) {
  if (typeof str !== "string") {
    throw new TypeError("Base32 string must be a string");
  }
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure random TOTP base32 secret.
 * 20 bytes (160 bits) recommended by RFC 4226 / RFC 6238.
 * @param {number} [byteLength=20]
 * @returns {string}
 */
export function generateTotpSecret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  return base32Encode(bytes);
}

/**
 * Generate HMAC-SHA1 HOTP for a given counter.
 * @param {Buffer} secretBytes
 * @param {number|bigint} counter
 * @param {number} [digits=6]
 * @returns {string}
 */
export function generateHotp(secretBytes, counter, digits = 6) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", secretBytes).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return (codeInt % mod).toString().padStart(digits, "0");
}

/**
 * Generate a 6-digit TOTP code for the given secret at a timestamp.
 * @param {string} secretBase32
 * @param {{ timestamp?: number, timeStepSec?: number, digits?: number }} [options]
 * @returns {string}
 */
export function generateTotp(secretBase32, options = {}) {
  const timeStepSec = options.timeStepSec ?? 30;
  const nowSec = Math.floor((options.timestamp ?? Date.now()) / 1000);
  const counter = Math.floor(nowSec / timeStepSec);
  const secretBytes = base32Decode(secretBase32);
  return generateHotp(secretBytes, counter, options.digits ?? 6);
}

/**
 * Verify a TOTP code within a configurable time window.
 * Default window is 1 (allows current, 1 previous [-30s], 1 next [+30s] step).
 * @param {string} code
 * @param {string} secretBase32
 * @param {{ timestamp?: number, timeStepSec?: number, window?: number, digits?: number }} [options]
 * @returns {{ valid: boolean, step?: number, reason?: string }}
 */
export function verifyTotp(code, secretBase32, options = {}) {
  const digits = options.digits ?? 6;
  const normalizedCode = String(code ?? "").trim();
  const codeRegex = new RegExp(`^\\d{${digits}}$`);
  if (!codeRegex.test(normalizedCode)) {
    return { valid: false, reason: "invalid_format" };
  }

  let secretBytes;
  try {
    secretBytes = base32Decode(secretBase32);
  } catch {
    return { valid: false, reason: "invalid_secret" };
  }
  if (!secretBytes || secretBytes.length === 0) {
    return { valid: false, reason: "invalid_secret" };
  }

  const window = options.window ?? 1;
  const timeStepSec = options.timeStepSec ?? 30;
  const nowSec = Math.floor((options.timestamp ?? Date.now()) / 1000);
  const currentStep = Math.floor(nowSec / timeStepSec);

  const inputBuffer = Buffer.from(normalizedCode);

  for (let i = -window; i <= window; i++) {
    const step = currentStep + i;
    const expected = generateHotp(secretBytes, step, digits);
    const expectedBuffer = Buffer.from(expected);
    if (
      inputBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(inputBuffer, expectedBuffer)
    ) {
      return { valid: true, step };
    }
  }

  return { valid: false, reason: "code_mismatch" };
}

/**
 * Generate 10 single-use alphanumeric backup recovery codes (e.g. "A1B2-C3D4").
 * @param {number} [count=10]
 * @returns {string[]}
 */
export function generateBackupCodes(count = 10) {
  const codes = new Set();
  while (codes.size < count) {
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.add(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return [...codes];
}

/**
 * Normalize and hash a recovery backup code for safe storage.
 * @param {string} code
 * @returns {string}
 */
export function hashBackupCode(code) {
  const normalized = String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return sha256Hex(normalized);
}

/**
 * Build an otpauth:// TOTP URI for authenticator QR codes.
 * @param {{ email: string, secret: string, issuer?: string }} args
 * @returns {string}
 */
export function generateTotpUri({ email, secret, issuer = "FlightOne" }) {
  const cleanEmail = email.trim();
  const cleanIssuer = issuer.trim();
  return (
    `otpauth://totp/${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanEmail)}` +
    `?secret=${encodeURIComponent(secret)}` +
    `&issuer=${encodeURIComponent(cleanIssuer)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}

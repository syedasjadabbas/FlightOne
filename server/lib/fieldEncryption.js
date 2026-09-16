/**
 * Module 00 field-level encryption helper used by Module 02 (PII document numbers).
 * AES-256-GCM. Ciphertext format: fo1:<iv_b64url>.<tag_b64url>.<ct_b64url>
 *
 * Set FIELD_ENCRYPTION_KEY to 64 hex chars (32 bytes) or a base64/base64url
 * encoding of 32 bytes. Without a key, encrypt/decrypt throw — never silently
 * store plaintext for new writes.
 */
import crypto from "crypto";

export const FIELD_ENC_PREFIX = "fo1:";

function resolveKeyBytes() {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set (required for PII field encryption)",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  // Derive a stable 32-byte key from an arbitrary secret (dev convenience).
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

let cachedKey = null;

export function getFieldEncryptionKey() {
  if (!cachedKey) cachedKey = resolveKeyBytes();
  return cachedKey;
}

/** Reset cached key — tests only. */
export function resetFieldEncryptionKeyCache() {
  cachedKey = null;
}

export function isEncryptedField(value) {
  return typeof value === "string" && value.startsWith(FIELD_ENC_PREFIX);
}

/**
 * Encrypt a plaintext PII string. Returns null for null/undefined/empty.
 * @param {string|null|undefined} plaintext
 * @returns {string|null}
 */
export function encryptField(plaintext) {
  if (plaintext == null) return null;
  const text = String(plaintext);
  if (!text) return null;

  const key = getFieldEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    FIELD_ENC_PREFIX +
    [
      iv.toString("base64url"),
      tag.toString("base64url"),
      enc.toString("base64url"),
    ].join(".")
  );
}

/**
 * Decrypt a ciphertext produced by encryptField.
 * Legacy plaintext (no fo1: prefix) is returned as-is for migration reads.
 * @param {string|null|undefined} stored
 * @returns {string|null}
 */
export function decryptField(stored) {
  if (stored == null) return null;
  const value = String(stored);
  if (!value) return null;
  if (!isEncryptedField(value)) {
    // Pre-encryption skeleton rows — readable until next write re-encrypts.
    return value;
  }

  const body = value.slice(FIELD_ENC_PREFIX.length);
  const parts = body.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted field format");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const key = getFieldEncryptionKey();
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

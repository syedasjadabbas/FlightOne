/**
 * Field-level encryption unit tests (Module 00 helper for Module 02 PII).
 * Run: node --test lib/fieldEncryption.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  encryptField,
  decryptField,
  isEncryptedField,
  resetFieldEncryptionKeyCache,
  FIELD_ENC_PREFIX,
} from "./fieldEncryption.js";

describe("fieldEncryption", () => {
  const prev = process.env.FIELD_ENCRYPTION_KEY;

  before(() => {
    process.env.FIELD_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    resetFieldEncryptionKeyCache();
  });

  after(() => {
    if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = prev;
    resetFieldEncryptionKeyCache();
  });

  it("round-trips passport-like numbers", () => {
    const plain = "AB1234567";
    const enc = encryptField(plain);
    assert.ok(enc.startsWith(FIELD_ENC_PREFIX));
    assert.notEqual(enc, plain);
    assert.equal(decryptField(enc), plain);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encryptField("CNIC-12345-67890");
    const b = encryptField("CNIC-12345-67890");
    assert.notEqual(a, b);
    assert.equal(decryptField(a), decryptField(b));
  });

  it("returns null for empty input", () => {
    assert.equal(encryptField(null), null);
    assert.equal(encryptField(""), null);
    assert.equal(decryptField(null), null);
  });

  it("passes through legacy plaintext on decrypt", () => {
    assert.equal(decryptField("LEGACYPLAIN"), "LEGACYPLAIN");
    assert.equal(isEncryptedField("LEGACYPLAIN"), false);
  });

  it("throws when key is missing", () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    resetFieldEncryptionKeyCache();
    assert.throws(() => encryptField("X"), /FIELD_ENCRYPTION_KEY/);
    process.env.FIELD_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    resetFieldEncryptionKeyCache();
  });
});

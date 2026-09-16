/**
 * Module 07 — Vault storage unit tests (no DB).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("vault.storage", () => {
  let root;
  let prevProvider;
  let prevRoot;

  before(async () => {
    prevProvider = process.env.VAULT_STORAGE_PROVIDER;
    prevRoot = process.env.VAULT_LOCAL_ROOT;
    root = await fs.mkdtemp(path.join(os.tmpdir(), "fo-vault-"));
  });

  after(async () => {
    if (prevProvider === undefined) delete process.env.VAULT_STORAGE_PROVIDER;
    else process.env.VAULT_STORAGE_PROVIDER = prevProvider;
    if (prevRoot === undefined) delete process.env.VAULT_LOCAL_ROOT;
    else process.env.VAULT_LOCAL_ROOT = prevRoot;
    await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it("reports unconfigured capability by default", async () => {
    delete process.env.VAULT_STORAGE_PROVIDER;
    delete process.env.VAULT_LOCAL_ROOT;
    const { getVaultStorageCapability, getVaultStorage } = await import(
      `./vault.storage.js?t=${Date.now()}`
    );
    const cap = getVaultStorageCapability();
    assert.equal(cap.configured, false);
    assert.equal(cap.canUpload, false);
    await assert.rejects(
      () => getVaultStorage().put({ storageKey: "a/b/c.pdf", buffer: Buffer.from("x") }),
      (err) => err.statusCode === 503 && err.code === "VAULT_STORAGE_UNCONFIGURED",
    );
  });

  it("validates MIME and size", async () => {
    const { validateUploadPayload, VAULT_MAX_BYTES } = await import(
      `./vault.storage.js?t=${Date.now() + 1}`
    );
    assert.throws(
      () =>
        validateUploadPayload({
          contentType: "application/exe",
          originalFilename: "x.exe",
          byteLength: 10,
        }),
      (err) => err.statusCode === 400,
    );
    assert.throws(
      () =>
        validateUploadPayload({
          contentType: "application/pdf",
          originalFilename: "x.pdf",
          byteLength: VAULT_MAX_BYTES + 1,
        }),
      (err) => err.statusCode === 400,
    );
  });

  it("rejects path traversal in storage keys", async () => {
    process.env.VAULT_STORAGE_PROVIDER = "local";
    process.env.VAULT_LOCAL_ROOT = root;
    const { getVaultStorage, assertSafeObjectKey } = await import(
      `./vault.storage.js?t=${Date.now() + 2}`
    );
    assert.throws(() => assertSafeObjectKey("../etc/passwd"), (err) => err.statusCode === 500);
    assert.throws(() => assertSafeObjectKey("/abs/path"), (err) => err.statusCode === 500);
    const storage = getVaultStorage();
    await assert.rejects(
      () => storage.put({ storageKey: "a/../b/c.pdf", buffer: Buffer.from("hi") }),
      (err) => err.statusCode === 500,
    );
  });

  it("local provider put/get round-trip", async () => {
    process.env.VAULT_STORAGE_PROVIDER = "local";
    process.env.VAULT_LOCAL_ROOT = root;
    const { getVaultStorage, getVaultStorageCapability } = await import(
      `./vault.storage.js?t=${Date.now() + 3}`
    );
    assert.equal(getVaultStorageCapability().configured, true);
    const storage = getVaultStorage();
    const key = "user1/doc1/passport.pdf";
    await storage.put({ storageKey: key, buffer: Buffer.from("%PDF-test") });
    const got = await storage.get({ storageKey: key });
    assert.equal(got.toString(), "%PDF-test");
  });
});

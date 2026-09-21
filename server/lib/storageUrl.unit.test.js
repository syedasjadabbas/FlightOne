import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedGcsUrl,
  isLocalStorageUrl,
  objectKeyFromGcsUrl,
  objectKeyFromLocalUrl,
} from "./storageUrl.js";

describe("storageUrl", () => {
  it("accepts path-style and virtual-hosted GCS URLs", () => {
    assert.equal(
      isAllowedGcsUrl("https://storage.googleapis.com/my-bucket/vault/a/b.pdf"),
      true,
    );
    assert.equal(
      isAllowedGcsUrl("https://my-bucket.storage.googleapis.com/vault/a/b.pdf"),
      true,
    );
    assert.equal(isAllowedGcsUrl("https://evil.example/x"), false);
  });

  it("parses object keys from GCS URLs", () => {
    assert.equal(
      objectKeyFromGcsUrl("https://storage.googleapis.com/my-bucket/vault/a/b.pdf"),
      "vault/a/b.pdf",
    );
    assert.equal(
      objectKeyFromGcsUrl("https://my-bucket.storage.googleapis.com/vault/a/b.pdf"),
      "vault/a/b.pdf",
    );
  });

  it("handles local:// URLs", () => {
    assert.equal(isLocalStorageUrl("local://user/doc/file.pdf"), true);
    assert.equal(objectKeyFromLocalUrl("local://user/doc/file.pdf"), "user/doc/file.pdf");
  });
});

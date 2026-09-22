/**
 * Signed-upload validation — no real GCS calls (fails fast on bad input
 * before touching the Storage client).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSignedUploadUrl } from "./uploads.service.js";

describe("uploads.service.createSignedUploadUrl", () => {
  it("rejects when the caller is not authenticated", async () => {
    await assert.rejects(
      () =>
        createSignedUploadUrl(
          { objectKey: "vault/u1/doc.pdf", contentType: "application/pdf" },
          {},
        ),
      /Authentication required/,
    );
  });

  it("rejects an unsupported content type", async () => {
    await assert.rejects(
      () =>
        createSignedUploadUrl(
          { objectKey: "vault/u1/doc.exe", contentType: "application/x-executable" },
          { userId: "u1" },
        ),
      /Unsupported file type/,
    );
  });

  it("rejects an objectKey outside the caller's own vault folder", async () => {
    await assert.rejects(
      () =>
        createSignedUploadUrl(
          { objectKey: "vault/someone-else/doc.pdf", contentType: "application/pdf" },
          { userId: "u1" },
        ),
      /scoped to the authenticated user/,
    );
  });

  it("rejects an objectKey outside the vault namespace entirely", async () => {
    await assert.rejects(
      () =>
        createSignedUploadUrl(
          { objectKey: "not-vault/u1/doc.pdf", contentType: "application/pdf" },
          { userId: "u1" },
        ),
      /scoped to the authenticated user/,
    );
  });
});

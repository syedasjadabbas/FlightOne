/**
 * OCR provider contract tests — no invented fields.
 * Run: node --test modules/profile/ocr/ocr.provider.test.js
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveOcrProvider,
  createHttpOcrProvider,
  unconfiguredOcrProvider,
  mapOcrExtraction,
  resetOcrProvider,
  setOcrProvider,
  getOcrProvider,
} from "./ocr.provider.js";

afterEach(() => resetOcrProvider());

describe("OCR provider contract", () => {
  it("unconfigured provider never invents document fields", async () => {
    const r = await unconfiguredOcrProvider.extract({
      documentType: "PASSPORT",
      vaultDocumentId: "vault-1",
      rawText: "PASSPORT AB1234567 PAKISTAN",
    });
    assert.equal(r.provider, "unconfigured");
    assert.deepEqual(r.fields, {});
    assert.ok(r.warnings.includes("ocr_provider_unconfigured"));
  });

  it("supports all PRD identity document types without fabricating", async () => {
    for (const type of ["PASSPORT", "NATIONAL_ID", "VISA", "RESIDENCE_PERMIT"]) {
      const r = await unconfiguredOcrProvider.extract({ documentType: type });
      assert.deepEqual(r.fields, {});
    }
  });

  it("default resolve is unconfigured when OCR_PROVIDER unset", () => {
    const p = resolveOcrProvider({});
    assert.equal(p.name, "unconfigured");
  });

  it("http provider without URL returns empty fields + warning", async () => {
    const p = createHttpOcrProvider({ env: { OCR_HTTP_URL: "" } });
    const r = await p.extract({ documentType: "NATIONAL_ID" });
    assert.deepEqual(r.fields, {});
    assert.ok(r.warnings.includes("ocr_http_url_not_configured"));
  });

  it("http provider maps only fields returned by remote (integration-style)", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        async json() {
          return {
            fields: {
              documentNumber: "P998877",
              countryCode: "pk",
              inventedShouldDrop: "nope",
            },
            confidence: 0.91,
          };
        },
      };
    };
    const p = createHttpOcrProvider({
      env: { OCR_HTTP_URL: "https://ocr.test/extract", OCR_HTTP_API_KEY: "k" },
      fetchImpl,
    });
    const r = await p.extract({
      documentType: "PASSPORT",
      vaultDocumentId: "v1",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.documentType, "PASSPORT");
    assert.equal(r.fields.documentNumber, "P998877");
    assert.equal(r.fields.countryCode, "PK");
    assert.equal(r.fields.inventedShouldDrop, undefined);
    assert.equal(r.confidence, 0.91);
  });

  it("http provider failure yields empty fields (no fake success data)", async () => {
    const p = createHttpOcrProvider({
      env: { OCR_HTTP_URL: "https://ocr.test/extract" },
      fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
    });
    const r = await p.extract({ documentType: "VISA" });
    assert.deepEqual(r.fields, {});
    assert.ok(r.warnings.some((w) => w.includes("ocr_http_status_503")));
  });

  it("mapOcrExtraction drops invalid countries and dates", () => {
    const mapped = mapOcrExtraction("RESIDENCE_PERMIT", {
      provider: "http",
      fields: {
        countryCode: "PAK",
        expiresAt: "not-a-date",
        documentNumber: "RP1",
      },
    });
    assert.equal(mapped.fields.countryCode, undefined);
    assert.equal(mapped.fields.expiresAt, undefined);
    assert.equal(mapped.fields.documentNumber, "RP1");
  });

  it("setOcrProvider override is used by getOcrProvider", async () => {
    setOcrProvider({
      name: "test",
      async extract() {
        return mapOcrExtraction("PASSPORT", {
          provider: "test",
          fields: { documentNumber: "T1" },
        });
      },
    });
    const r = await getOcrProvider().extract({ documentType: "PASSPORT" });
    assert.equal(r.fields.documentNumber, "T1");
  });

  it("http provider includes contentBase64 when send-binary enabled", async () => {
    const calls = [];
    const p = createHttpOcrProvider({
      env: {
        OCR_HTTP_URL: "https://ocr.test/extract",
        OCR_HTTP_SEND_BINARY: "true",
      },
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(init.body));
        return { ok: true, async json() { return { fields: {} }; } };
      },
    });
    await p.extract({
      documentType: "PASSPORT",
      vaultDocumentId: "v1",
      hasBinary: true,
      contentType: "application/pdf",
      contentBase64: "JVBERi0x",
    });
    assert.equal(calls[0].contentBase64, "JVBERi0x");
    assert.equal(calls[0].hasBinary, true);
  });

  it("http provider omits contentBase64 when OCR_HTTP_SEND_BINARY=false", async () => {
    const calls = [];
    const p = createHttpOcrProvider({
      env: {
        OCR_HTTP_URL: "https://ocr.test/extract",
        OCR_HTTP_SEND_BINARY: "false",
      },
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(init.body));
        return { ok: true, async json() { return { fields: {} }; } };
      },
    });
    await p.extract({
      documentType: "PASSPORT",
      contentBase64: "JVBERi0x",
      hasBinary: true,
    });
    assert.equal(calls[0].contentBase64, undefined);
  });

  it("unconfigured warns when binary is present but unused", async () => {
    const r = await unconfiguredOcrProvider.extract({
      documentType: "PASSPORT",
      hasBinary: true,
      contentBase64: "abc",
    });
    assert.ok(r.warnings.includes("binary_ignored_without_provider"));
    assert.deepEqual(r.fields, {});
  });
});

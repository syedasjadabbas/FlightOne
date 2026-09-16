/**
 * Module 16 — AI Knowledge Platform unit tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chunkDocumentContent,
  extractTextFromUpload,
  tokenize,
} from "./knowledge.service.js";

describe("Module 16 knowledge unit", () => {
  it("tokenizes and drops stopwords", () => {
    const t = tokenize("What is the cancellation SOP for FlightOne?");
    assert.ok(t.includes("cancellation"));
    assert.ok(t.includes("sop"));
    assert.ok(!t.includes("the"));
  });

  it("chunks by paragraph without inventing content", () => {
    const longA = "A".repeat(500);
    const longB = "B".repeat(500);
    const chunks = chunkDocumentContent(`${longA}\n\n${longB}`);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks[0].includes("A"));
    assert.ok(chunks.some((c) => c.includes("B")));
    assert.ok(chunks.every((c) => !c.includes("invented-policy-xyz")));
  });

  it("rejects executable and unsupported uploads", () => {
    const exe = extractTextFromUpload({
      filename: "x.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0x4d, 0x5a, 0x00]),
    });
    assert.equal(exe.ok, false);

    const pdf = extractTextFromUpload({
      filename: "a.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF"),
    });
    assert.equal(pdf.ok, false);
    assert.equal(pdf.ingestionStatus, "UNSUPPORTED");
  });

  it("extracts plain text uploads", () => {
    const r = extractTextFromUpload({
      filename: "sop.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("FlightOne cancellation SOP step one.", "utf8"),
    });
    assert.equal(r.ok, true);
    assert.equal(r.ingestionStatus, "READY");
    assert.match(r.content, /cancellation SOP/);
  });
});

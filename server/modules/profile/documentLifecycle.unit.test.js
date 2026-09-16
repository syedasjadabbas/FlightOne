/**
 * Document expiry + OCR unit tests (no DB).
 * Run: node --test modules/profile/documentLifecycle.unit.test.js
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  assertValidDocumentDates,
  computeExpiryStatus,
  dueExpiryLeadNotifications,
  expiryNotificationDedupeKey,
  PRD_DEFAULT_EXPIRY_LEAD_DAYS,
} from "./documentExpiry.js";
import {
  mapOcrExtraction,
  unconfiguredOcrProvider,
  resetOcrProvider,
} from "./ocr/ocr.provider.js";
import { createIdentityDocumentSchema } from "./profile.validators.js";
import { ZodError } from "zod";

describe("document expiry calculation", () => {
  it("uses PRD lead times 180 / 30 / 7", () => {
    assert.deepEqual(PRD_DEFAULT_EXPIRY_LEAD_DAYS, [180, 30, 7]);
  });

  it("marks expired when past expiry", () => {
    const s = computeExpiryStatus("2020-01-01", {
      now: new Date("2026-09-03T12:00:00Z"),
      leadDays: [180, 30, 7],
    });
    assert.equal(s.state, "expired");
    assert.equal(s.isExpired, true);
    assert.ok(s.daysRemaining < 0);
  });

  it("marks expiring_soon inside lead window", () => {
    const s = computeExpiryStatus("2026-09-10", {
      now: new Date("2026-09-03T12:00:00Z"),
      leadDays: [180, 30, 7],
    });
    assert.equal(s.state, "expiring_soon");
    assert.equal(s.matchedLeadDays, 7);
    assert.equal(s.daysRemaining, 7);
  });

  it("marks valid outside lead windows", () => {
    const s = computeExpiryStatus("2027-09-03", {
      now: new Date("2026-09-03T12:00:00Z"),
      leadDays: [180, 30, 7],
    });
    assert.equal(s.state, "valid");
    assert.equal(s.matchedLeadDays, null);
  });

  it("unknown when expiry missing", () => {
    assert.equal(computeExpiryStatus(null).state, "unknown");
  });

  it("rejects expiresAt before issuedAt", () => {
    assert.throws(
      () =>
        assertValidDocumentDates(
          new Date("2030-01-01"),
          new Date("2020-01-01"),
        ),
      /expiresAt must be on or after issuedAt/,
    );
  });

  it("due leads include all crossed thresholds (dedupe is separate)", () => {
    const due = dueExpiryLeadNotifications("2026-09-10", {
      now: new Date("2026-09-03T12:00:00Z"),
      leadDays: [180, 30, 7],
    });
    assert.deepEqual(due.sort((a, b) => b - a), [180, 30, 7]);
  });

  it("builds stable dedupe keys per document + lead", () => {
    assert.equal(
      expiryNotificationDedupeKey("doc1", 30),
      "profile-doc-expiry:doc1:lead:30",
    );
  });
});

describe("OCR extraction mapping", () => {
  after(() => resetOcrProvider());

  it("maps only present fields and never invents values", () => {
    const mapped = mapOcrExtraction("PASSPORT", {
      provider: "test",
      fields: { documentNumber: "AB123", countryCode: "pk", bogus: "x" },
      confidence: 0.9,
    });
    assert.equal(mapped.fields.documentNumber, "AB123");
    assert.equal(mapped.fields.countryCode, "PK");
    assert.equal(mapped.fields.expiresAt, undefined);
    assert.equal(mapped.fields.bogus, undefined);
  });

  it("unconfigured provider returns empty fields (no fake OCR)", async () => {
    const r = await unconfiguredOcrProvider.extract({
      documentType: "NATIONAL_ID",
      rawText: "CNIC 12345-6789012-3",
    });
    assert.deepEqual(r.fields, {});
    assert.ok(r.warnings.includes("ocr_provider_unconfigured"));
  });

  it("rejects invalid create dates via schema", () => {
    assert.throws(
      () =>
        createIdentityDocumentSchema.parse({
          type: "PASSPORT",
          issuedAt: "2030-01-01",
          expiresAt: "2020-01-01",
        }),
      ZodError,
    );
  });
});

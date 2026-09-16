/**
 * Module 08 — visa notification helpers (no DB required for pure functions).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeApplyByDate,
  getVisaApplyByLeadDays,
  getVisaExpiryLeadDays,
  visaApplyByDedupeKey,
  visaExpiryDedupeKey,
  scheduleVisaApplyByNotifications,
} from "./visa.notifications.js";

describe("visa.notifications pure helpers", () => {
  it("default visa expiry lead days match Phase-1 reminders", () => {
    assert.deepEqual(getVisaExpiryLeadDays({}), [180, 30, 7]);
  });

  it("default apply-by lead days are 30/14/7", () => {
    assert.deepEqual(getVisaApplyByLeadDays({}), [30, 14, 7]);
  });

  it("computeApplyByDate never invents when inputs missing", () => {
    assert.equal(computeApplyByDate(null, 10), null);
    assert.equal(computeApplyByDate("2026-10-01", null), null);
    assert.equal(computeApplyByDate("not-a-date", 5), null);
  });

  it("computeApplyByDate subtracts attributed max processing days", () => {
    const applyBy = computeApplyByDate("2026-10-31T00:00:00.000Z", 10);
    assert.ok(applyBy instanceof Date);
    assert.equal(applyBy.toISOString().slice(0, 10), "2026-10-21");
  });

  it("stable dedupe keys", () => {
    assert.equal(visaExpiryDedupeKey("doc1", 30), "visa-doc-expiry:doc1:lead:30");
    assert.equal(visaApplyByDedupeKey("bk1", 14), "visa-apply-by:bk1:lead:14");
  });

  it("apply-by skips when processingDaysMax is not attributed fact/stale", async () => {
    const result = await scheduleVisaApplyByNotifications(
      {
        id: "b1",
        userId: "u1",
        metadata: { departAt: "2026-10-01", destination: "AE", nationality: "PK" },
      },
      {
        isFact: false,
        dataStatus: "DATA_UNAVAILABLE",
        processingDaysMax: 15,
      },
      { now: new Date("2026-09-01"), channels: ["APP"] },
    );
    assert.equal(result.enqueued, 0);
    assert.equal(result.skippedReason, "missing_departAt_or_attributed_processingDaysMax");
  });

  it("apply-by skips when departAt missing even if processing days exist", async () => {
    const result = await scheduleVisaApplyByNotifications(
      { id: "b2", userId: "u1", metadata: {} },
      { isFact: true, dataStatus: "VERIFIED", processingDaysMax: 10 },
      { now: new Date("2026-09-01"), channels: ["APP"] },
    );
    assert.equal(result.enqueued, 0);
    assert.equal(result.skippedReason, "missing_departAt_or_attributed_processingDaysMax");
  });
});

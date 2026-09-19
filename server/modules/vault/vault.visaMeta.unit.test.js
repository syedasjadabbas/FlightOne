/**
 * Phase 2 Visa Vault — unit tests for visa metadata display status.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeVisaDisplayStatus, toPublicVisaMeta } from "./vault.visaMeta.js";

describe("vault.visaMeta", () => {
  const now = new Date("2026-09-19T00:00:00.000Z");

  it("derives EXPIRED from expiresAt rather than stored holderStatus", () => {
    assert.equal(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: "2026-01-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
      "EXPIRED",
    );
  });

  it("marks EXPIRING within 90 days", () => {
    assert.equal(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: "2026-10-10T00:00:00.000Z",
        isActive: true,
        now,
      }),
      "EXPIRING",
    );
  });

  it("does not invent expiry when no date is stored", () => {
    assert.equal(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: null,
        isActive: true,
        now,
      }),
      "ISSUED",
    );
  });

  it("CANCELLED wins over a future expiry", () => {
    assert.equal(
      computeVisaDisplayStatus({
        holderStatus: "CANCELLED",
        expiresAt: "2027-01-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
      "CANCELLED",
    );
  });

  it("maps public visaMeta without leaking extra fields", () => {
    const publicMeta = toPublicVisaMeta(
      {
        destinationCode: "AE",
        visaType: "tourist",
        holderStatus: "ISSUED",
        visaApplicationId: "app1",
        appointmentAt: null,
        appointmentLocation: "Dubai",
        issuingAuthority: "UAE Embassy",
        remindersEnabled: true,
      },
      { expiresAt: "2028-01-01", isActive: true, now },
    );
    assert.equal(publicMeta.destinationCode, "AE");
    assert.equal(publicMeta.visaStatus, "ISSUED");
    assert.equal(publicMeta.remindersEnabled, true);
    assert.equal("storageKey" in publicMeta, false);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeVisaDisplayStatus,
  daysUntilExpiry,
  visaStatusLabel,
} from "@/lib/vault/visaStatus";

describe("visa vault status helpers", () => {
  const now = Date.parse("2026-09-19T00:00:00.000Z");

  it("treats past expiry as EXPIRED even when holder says ISSUED", () => {
    expect(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: "2026-01-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("EXPIRED");
  });

  it("marks visas within 90 days as EXPIRING", () => {
    expect(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: "2026-10-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("EXPIRING");
  });

  it("does not invent expiry when no date is stored", () => {
    expect(daysUntilExpiry(null)).toBeNull();
    expect(
      computeVisaDisplayStatus({
        holderStatus: "ISSUED",
        expiresAt: null,
        isActive: true,
        now,
      }),
    ).toBe("ISSUED");
  });

  it("preserves cancelled/pending over expiry windows", () => {
    expect(
      computeVisaDisplayStatus({
        holderStatus: "CANCELLED",
        expiresAt: "2027-01-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("CANCELLED");
    expect(
      computeVisaDisplayStatus({
        holderStatus: "PENDING",
        expiresAt: "2027-01-01T00:00:00.000Z",
        isActive: true,
        now,
      }),
    ).toBe("PENDING");
  });

  it("labels statuses for vault UI", () => {
    expect(visaStatusLabel("EXPIRED")).toBe("Expired");
    expect(visaStatusLabel("EXPIRING")).toBe("Expiring soon");
  });
});

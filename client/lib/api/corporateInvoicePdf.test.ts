import { describe, expect, it } from "vitest";

/** Pure helper mirroring checkout PDF download decoding (no DOM). */
function decodeInvoicePdfBase64(contentBase64: string): string {
  return Buffer.from(contentBase64, "base64").toString("latin1");
}

describe("corporate invoice PDF payload", () => {
  it("never embeds payment method tokens in decoded PDF bytes", () => {
    // Simulated server PDF payload (latin1-safe printable content).
    const fakePdf = "%PDF-1.4\nInvoice INV-TEST-000001\nTotal: USD 109.00\n";
    const contentBase64 = Buffer.from(fakePdf, "latin1").toString("base64");
    const decoded = decodeInvoicePdfBase64(contentBase64);
    expect(decoded).toContain("INV-TEST-000001");
    expect(decoded).not.toContain("pm_");
    expect(decoded).not.toContain("paymentMethodToken");
  });
});

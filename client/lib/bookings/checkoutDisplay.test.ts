import { describe, expect, it } from "vitest";
import {
  formatMinor,
  ticketNumbersFromMetadata,
  voucherRefsFromMetadata,
} from "./checkoutDisplay";

describe("checkoutDisplay", () => {
  it("formats server minor amounts", () => {
    expect(formatMinor(10900, "USD")).toMatch(/109/);
  });

  it("exposes ticket/voucher refs only from server metadata", () => {
    const metadata = {
      supplierBooking: {
        ticket: {
          ticketNumbers: ["1234567890123"],
          voucherRefs: ["RH-99"],
        },
      },
    };
    expect(ticketNumbersFromMetadata(metadata)).toEqual(["1234567890123"]);
    expect(voucherRefsFromMetadata(metadata)).toEqual(["RH-99"]);
    expect(ticketNumbersFromMetadata(undefined)).toEqual([]);
  });
});

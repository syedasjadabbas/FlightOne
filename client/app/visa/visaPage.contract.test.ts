import { describe, expect, it } from "vitest";
import { visaWarningFromMetadata } from "@/lib/bookings/visaCheckoutWarning";

/**
 * Smoke coverage for /visa UX contracts used by VisaPageClient + checkout.
 * Full React render of VisaPageClient is covered indirectly via API types + warning helper.
 */
describe("visa UI contracts", () => {
  it("checkout warning copy never claims booking is blocked", () => {
    const w = visaWarningFromMetadata({
      visaCheck: {
        category: "EMBASSY",
        isFact: false,
        dataStatus: "STALE",
        escalateRecommended: true,
      },
    });
    expect(w?.show).toBe(true);
    expect(w?.body.toLowerCase()).not.toMatch(/cannot book|booking blocked|must cancel/);
    expect(w?.body).toMatch(/not blocked/i);
  });

  it("fact vs guidance is explicit on warning payload", () => {
    const fact = visaWarningFromMetadata({
      visaCheck: { category: "E_VISA", isFact: true, dataStatus: "VERIFIED" },
    });
    const guidance = visaWarningFromMetadata({
      visaCheck: { category: "UNKNOWN", isFact: false, dataStatus: "UNCONFIGURED" },
    });
    expect(fact?.isFact).toBe(true);
    expect(guidance?.isFact).toBe(false);
  });
});

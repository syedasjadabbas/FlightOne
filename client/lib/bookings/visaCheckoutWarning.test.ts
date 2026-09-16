import { describe, expect, it } from "vitest";
import { visaWarningFromMetadata } from "@/lib/bookings/visaCheckoutWarning";

describe("visaWarningFromMetadata", () => {
  it("returns null when visaCheck missing", () => {
    expect(visaWarningFromMetadata({})).toBeNull();
    expect(visaWarningFromMetadata(null)).toBeNull();
  });

  it("stays silent for attributed visa-free without escalation", () => {
    expect(
      visaWarningFromMetadata({
        visaCheck: {
          category: "VISA_FREE",
          isFact: true,
          dataStatus: "VERIFIED",
          escalateRecommended: false,
        },
      }),
    ).toBeNull();
  });

  it("surfaces caution for VOA / embassy / stale without blocking", () => {
    const w = visaWarningFromMetadata({
      visaCheck: {
        category: "VOA",
        isFact: true,
        dataStatus: "VERIFIED",
        escalateRecommended: false,
      },
    });
    expect(w?.show).toBe(true);
    expect(w?.severity).toBe("caution");
    expect(w?.body).toMatch(/not blocked/i);
  });

  it("info severity for incomplete inputs", () => {
    const w = visaWarningFromMetadata({
      visaCheck: {
        dataStatus: "INCOMPLETE_INPUTS",
        missingInputs: ["nationality"],
        isFact: false,
      },
    });
    expect(w?.severity).toBe("info");
    expect(w?.title).toMatch(/incomplete/i);
  });

  it("distinguishes non-fact guidance", () => {
    const w = visaWarningFromMetadata({
      visaCheck: {
        category: "UNKNOWN",
        isFact: false,
        dataStatus: "DATA_UNAVAILABLE",
        escalateRecommended: true,
      },
    });
    expect(w?.isFact).toBe(false);
    expect(w?.escalateRecommended).toBe(true);
  });
});

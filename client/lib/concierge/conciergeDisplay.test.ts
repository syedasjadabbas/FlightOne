import { describe, expect, it } from "vitest";
import {
  CONCIERGE_ACTION_LABELS,
  conciergeStatusLabel,
  conciergeStatusTone,
  formatConciergeBudget,
} from "@/lib/concierge/conciergeDisplay";

describe("conciergeDisplay", () => {
  it("formats authorised budget in major units", () => {
    expect(formatConciergeBudget(2_000_000, "PKR")).toContain("PKR");
    expect(formatConciergeBudget(2_000_000, "PKR")).toContain("20,000");
  });

  it("labels autonomous action as quote-only, never silent ticketing", () => {
    expect(CONCIERGE_ACTION_LABELS.AUTONOMOUS_REBOOK.toLowerCase()).toContain("never tickets");
    expect(conciergeStatusLabel("PENDING_CONFIRMATION")).toMatch(/confirmation/i);
    expect(conciergeStatusLabel("BLOCKED")).toMatch(/held/i);
  });

  it("maps status tones for chips", () => {
    expect(conciergeStatusTone("EXECUTED")).toBe("default");
    expect(conciergeStatusTone("FAILED")).toBe("warn");
    expect(conciergeStatusTone("SKIPPED")).toBe("muted");
  });
});

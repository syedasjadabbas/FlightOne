import { describe, expect, it } from "vitest";
import { formatRefundGuidanceForPrompt, isRefundQuestion } from "@/lib/ask-ai/refundGuidance";

describe("Module 14 refundGuidance", () => {
  it("detects refund / change / credit questions", () => {
    expect(isRefundQuestion("Can I get a refund?")).toBe(true);
    expect(isRefundQuestion("What is the cancellation penalty?")).toBe(true);
    expect(isRefundQuestion("Can I reissue this ticket?")).toBe(true);
    expect(isRefundQuestion("find flights to DXB")).toBe(false);
  });

  it("guidance forbids invention", () => {
    const g = formatRefundGuidanceForPrompt(null);
    expect(g).toMatch(/never invent/i);
  });
});

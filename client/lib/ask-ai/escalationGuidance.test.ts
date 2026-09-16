import { describe, expect, it } from "vitest";
import {
  detectEscalationIntent,
  formatEscalationGuidanceForPrompt,
  honestHandoffReply,
} from "@/lib/ask-ai/escalationGuidance";

describe("Module 13 escalationGuidance", () => {
  it("detects customer human requests", () => {
    expect(detectEscalationIntent("I want to speak to a human")).toBe("CUSTOMER_REQUEST");
    expect(detectEscalationIntent("Connect me with an agent")).toBe("CUSTOMER_REQUEST");
    expect(detectEscalationIntent("I need a travel consultant")).toBe("CUSTOMER_REQUEST");
  });

  it("detects medical / SSR / refund dispute", () => {
    expect(detectEscalationIntent("Need medical assistance")).toBe("MEDICAL_ASSISTANCE");
    expect(detectEscalationIntent("special service request for meal")).toBe(
      "SPECIAL_SERVICE_REQUEST",
    );
    expect(detectEscalationIntent("I dispute my refund")).toBe("REFUND_DISPUTE");
  });

  it("honest handoff never claims assignment or refund approval", () => {
    const reply = honestHandoffReply({
      trigger: "CUSTOMER_REQUEST",
      escalationId: "abc123xyz",
      status: "OPEN",
    });
    expect(reply).toMatch(/has not been assigned/i);
    expect(reply).not.toMatch(/refund was approved/i);
    expect(reply).not.toMatch(/consultant has replied/i);
  });

  it("guidance forbids false claims", () => {
    const g = formatEscalationGuidanceForPrompt();
    expect(g).toMatch(/Never claim a consultant has replied/i);
  });
});

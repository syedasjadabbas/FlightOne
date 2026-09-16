import { describe, expect, it } from "vitest";
import {
  complexTripLlmFallbackAsk,
  llmUnavailableReply,
} from "./serviceMessages";

describe("serviceMessages LLM unavailable", () => {
  it("does not invent traffic / capacity excuses", () => {
    const simple = llmUnavailableReply();
    const complex = llmUnavailableReply({ complex: true });
    const clarify = complexTripLlmFallbackAsk();
    for (const msg of [simple, complex, clarify]) {
      expect(msg).not.toMatch(/heavy traffic|high demand|overwhelmed|capacity/i);
      expect(msg).toMatch(/unreachable|try again/i);
    }
  });

  it("complex clarify asks for a departure date", () => {
    expect(complexTripLlmFallbackAsk()).toMatch(/departure date/i);
    expect(complexTripLlmFallbackAsk()).not.toMatch(/where would you like to fly/i);
  });
});

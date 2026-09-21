/**
 * LLM completion request validators.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { completionRequestSchema } from "./llm.validators.js";

describe("llm.validators — completionRequestSchema", () => {
  it("accepts a valid completion body", () => {
    const parsed = completionRequestSchema.parse({
      system: "You are a travel assistant.",
      messages: [
        { role: "user", content: "Find flights to Dubai" },
        { role: "assistant", content: "Sure — when do you want to travel?" },
      ],
      temperature: 0.4,
      maxTokens: 512,
      timeoutMs: 30000,
      json: false,
      thinkingLevel: "low",
    });
    assert.equal(parsed.system, "You are a travel assistant.");
    assert.equal(parsed.messages.length, 2);
    assert.equal(parsed.thinkingLevel, "low");
  });

  it("rejects an invalid message role", () => {
    assert.throws(
      () =>
        completionRequestSchema.parse({
          system: "You are a travel assistant.",
          messages: [{ role: "system", content: "not allowed in turns" }],
        }),
      (err) => err instanceof Error && /Invalid enum value|role/i.test(String(err)),
    );
  });
});

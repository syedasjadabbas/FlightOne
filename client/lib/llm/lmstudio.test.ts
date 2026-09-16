import { describe, expect, it } from "vitest";
import { extractJsonObject, stripThinkBlocks } from "./lmstudio";

describe("stripThinkBlocks", () => {
  it("removes qwen-style think wrappers", () => {
    expect(
      stripThinkBlocks("<think>plan the trip</think>\n{\"ok\":true}"),
    ).toBe('{"ok":true}');
  });

  it("leaves plain text alone", () => {
    expect(stripThinkBlocks("Hello from Ava")).toBe("Hello from Ava");
  });
});

describe("extractJsonObject", () => {
  it("pulls the first valid object from prose", () => {
    expect(
      extractJsonObject('notes...\n{"action":"search","searches":[]}\ntrailing'),
    ).toBe('{"action":"search","searches":[]}');
  });
});

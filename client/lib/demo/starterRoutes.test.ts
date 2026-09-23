import { describe, expect, it } from "vitest";
import corpus from "./galileo-fares.json";
import { STARTER_ROUTES } from "@/app/components/chat/chatQuickPrompts";

/**
 * The empty-chat starter cards are hard-coded (the corpus is too big to ship to
 * the browser). This keeps them honest: every prompt must be a corpus query
 * word for word, or the card would lead to an empty or fuzzy-matched search.
 */
describe("chat starter routes", () => {
  const corpusQueries = new Set<string>([
    ...corpus.queries.map((q) => q.query),
    ...corpus.journeys.map((j) => j.query),
  ]);

  it("offers exactly three cards", () => {
    expect(STARTER_ROUTES).toHaveLength(3);
  });

  it.each(STARTER_ROUTES.map((r) => [r.title, r.prompt]))(
    "%s sends a query that exists in the demo corpus",
    (_title, prompt) => {
      expect(corpusQueries.has(prompt)).toBe(true);
    },
  );

  it("covers one-way, round trip and multi-city", () => {
    const prompts = STARTER_ROUTES.map((r) => r.prompt);
    expect(prompts.some((p) => /^Multi-city:/.test(p))).toBe(true);
    expect(prompts.some((p) => /\bround trip\b|\breturn\b/i.test(p))).toBe(true);
    expect(prompts.some((p) => !/Multi-city|round trip|return/i.test(p))).toBe(true);
  });

  it("keeps the card copy short enough to sit on one line", () => {
    for (const r of STARTER_ROUTES) {
      expect(r.title.length).toBeLessThanOrEqual(24);
      expect(r.subtitle.length).toBeLessThanOrEqual(32);
    }
  });
});

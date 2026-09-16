/**
 * Within-account dedupe helpers (no DB).
 * Run: node --test modules/profile/profileDedupe.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "./profileDedupe.service.js";

describe("profileDedupe normalizeName", () => {
  it("collapses case and whitespace", () => {
    assert.equal(normalizeName("  Ada   Lovelace "), "ada lovelace");
  });
});

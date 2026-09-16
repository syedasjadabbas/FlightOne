/**
 * Travelport workbench id helper.
 * Run: node --test modules/suppliers/travelport/workbench.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractWorkbenchId } from "./workbench.js";

describe("extractWorkbenchId", () => {
  it("reads nested Identifier.value", () => {
    assert.equal(
      extractWorkbenchId({ ReservationWorkbench: { Identifier: { value: " wb-1 " } } }),
      "wb-1",
    );
  });

  it("returns null for missing or blank ids", () => {
    assert.equal(extractWorkbenchId(null), null);
    assert.equal(extractWorkbenchId({}), null);
    assert.equal(extractWorkbenchId({ id: "   " }), null);
  });
});

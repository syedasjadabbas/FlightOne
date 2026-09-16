/**
 * Module 09 — JourneyWatch worker selection helpers (no DB).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterDueWatches,
  workerWindowCutoffs,
  mapLimit,
} from "./journey.workerSelect.js";

describe("journey.workerSelect", () => {
  it("filters watches already polled inside cooldown", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const cooldownCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    const due = filterDueWatches(
      [
        { id: "a", lastPolledAt: null },
        { id: "b", lastPolledAt: new Date(now.getTime() - 60 * 1000) },
        { id: "c", lastPolledAt: new Date(now.getTime() - 10 * 60 * 1000) },
      ],
      cooldownCutoff,
    );
    assert.deepEqual(
      due.map((w) => w.id),
      ["a", "c"],
    );
  });

  it("worker window cutoffs are env-bounded", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const w = workerWindowCutoffs(now, {
      JOURNEY_WORKER_LOOKAHEAD_MS: String(60_000),
      JOURNEY_WORKER_LOOKBEHIND_MS: String(30_000),
      JOURNEY_WORKER_COOLDOWN_MS: String(10_000),
    });
    assert.equal(w.lookaheadCutoff.getTime() - now.getTime(), 60_000);
    assert.equal(now.getTime() - w.lookbehindCutoff.getTime(), 30_000);
    assert.equal(now.getTime() - w.cooldownCutoff.getTime(), 10_000);
  });

  it("mapLimit bounds concurrency and preserves order", async () => {
    const active = { n: 0, max: 0 };
    const results = await mapLimit([1, 2, 3, 4, 5], 2, async (x) => {
      active.n += 1;
      active.max = Math.max(active.max, active.n);
      await new Promise((r) => setTimeout(r, 20));
      active.n -= 1;
      return x * 10;
    });
    assert.deepEqual(results, [10, 20, 30, 40, 50]);
    assert.ok(active.max <= 2);
  });
});

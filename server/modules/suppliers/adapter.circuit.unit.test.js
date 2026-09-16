/**
 * Circuit breaker unit tests — process-local OPEN / HALF_OPEN / CLOSED.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getSupplierCircuitStateForTests,
  resetSupplierCircuitsForTests,
  withCircuitBreaker,
} from "./adapter.circuit.js";

describe("supplier circuit breaker", () => {
  beforeEach(() => {
    resetSupplierCircuitsForTests();
  });

  it("closes after success and documents process_local scope", async () => {
    const out = await withCircuitBreaker("T1", async () => "ok", { failLimit: 2, openMs: 50 });
    assert.equal(out, "ok");
    const st = getSupplierCircuitStateForTests("T1");
    assert.equal(st.scope, "process_local");
    assert.equal(st.open, false);
  });

  it("opens after failLimit failures", async () => {
    const boom = () => {
      throw Object.assign(new Error("down"), { code: "ECONN" });
    };
    await assert.rejects(() => withCircuitBreaker("T2", boom, { failLimit: 2, openMs: 5_000 }));
    await assert.rejects(() => withCircuitBreaker("T2", boom, { failLimit: 2, openMs: 5_000 }));
    const st = getSupplierCircuitStateForTests("T2");
    assert.equal(st.open, true);

    await assert.rejects(
      () => withCircuitBreaker("T2", async () => "should-not-run", { failLimit: 2, openMs: 5_000 }),
      (e) => e.code === "SUPPLIER_CIRCUIT_OPEN",
    );
  });

  it("half-open allows one probe after cooldown then closes on success", async () => {
    const boom = () => {
      throw Object.assign(new Error("down"), { code: "ECONN" });
    };
    await assert.rejects(() => withCircuitBreaker("T3", boom, { failLimit: 1, openMs: 30 }));
    assert.equal(getSupplierCircuitStateForTests("T3").open, true);

    await new Promise((r) => setTimeout(r, 40));
    const recovered = await withCircuitBreaker("T3", async () => "up", { failLimit: 1, openMs: 30 });
    assert.equal(recovered, "up");
    assert.equal(getSupplierCircuitStateForTests("T3").open, false);
  });

  it("half-open rejects concurrent probes while one is in flight", async () => {
    const boom = () => {
      throw Object.assign(new Error("down"), { code: "ECONN" });
    };
    await assert.rejects(() => withCircuitBreaker("T4", boom, { failLimit: 1, openMs: 20 }));
    await new Promise((r) => setTimeout(r, 25));

    let release;
    const gate = new Promise((r) => {
      release = r;
    });

    const slow = withCircuitBreaker(
      "T4",
      async () => {
        await gate;
        return "slow-ok";
      },
      { failLimit: 1, openMs: 20 },
    );

    await new Promise((r) => setTimeout(r, 5));
    await assert.rejects(
      () => withCircuitBreaker("T4", async () => "other", { failLimit: 1, openMs: 20 }),
      (e) => e.code === "SUPPLIER_CIRCUIT_OPEN",
    );

    release();
    assert.equal(await slow, "slow-ok");
  });

  it("onOpen return path does not throw", async () => {
    const boom = () => {
      throw Object.assign(new Error("down"), { code: "ECONN" });
    };
    await assert.rejects(() => withCircuitBreaker("T5", boom, { failLimit: 1, openMs: 5_000 }));
    const v = await withCircuitBreaker("T5", async () => "x", {
      failLimit: 1,
      openMs: 5_000,
      onOpen: "return",
      openResult: [],
    });
    assert.deepEqual(v, []);
  });
});

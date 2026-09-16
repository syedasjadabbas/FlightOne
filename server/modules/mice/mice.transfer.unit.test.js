/**
 * Module 12 — MICE transfer provider boundary (unit).
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  attemptMiceTransferBooking,
  getMiceTransferCapability,
  resetMiceTransferBookFetcherForTests,
  setMiceTransferBookFetcherForTests,
} from "./mice.transferProvider.js";

describe("mice.transferProvider", () => {
  after(() => resetMiceTransferBookFetcherForTests());

  it("defaults to unconfigured — cannot book live", () => {
    const cap = getMiceTransferCapability({ MICE_TRANSFER_BOOK_PROVIDER: "unconfigured" });
    assert.equal(cap.configured, false);
    assert.equal(cap.canBookLive, false);
  });

  it("http without URL is misconfigured", () => {
    const cap = getMiceTransferCapability({
      MICE_TRANSFER_BOOK_PROVIDER: "http",
      MICE_TRANSFER_BOOK_HTTP_URL: "",
    });
    assert.equal(cap.canBookLive, false);
  });

  it("unconfigured attempt returns PROVIDER_UNCONFIGURED — never CONFIRMED", async () => {
    resetMiceTransferBookFetcherForTests();
    const prev = process.env.MICE_TRANSFER_BOOK_PROVIDER;
    process.env.MICE_TRANSFER_BOOK_PROVIDER = "unconfigured";
    const result = await attemptMiceTransferBooking({ transferId: "t1", label: "Pickup" });
    assert.equal(result.ok, false);
    assert.equal(result.status, "PROVIDER_UNCONFIGURED");
    assert.equal(result.transferRef, null);
    process.env.MICE_TRANSFER_BOOK_PROVIDER = prev;
  });

  it("provider failure surfaces FAILED without confirmation", async () => {
    process.env.NODE_ENV = "test";
    setMiceTransferBookFetcherForTests(async () => {
      throw new Error("upstream down");
    });
    const result = await attemptMiceTransferBooking({ transferId: "t1" });
    assert.equal(result.status, "FAILED");
    assert.equal(result.transferRef, null);
    resetMiceTransferBookFetcherForTests();
  });

  it("CONFIRMED only when confirmationRef is present", async () => {
    process.env.NODE_ENV = "test";
    setMiceTransferBookFetcherForTests(async () => ({
      confirmationRef: "TR-OK-1",
      status: "CONFIRMED",
    }));
    const result = await attemptMiceTransferBooking({ transferId: "t1" });
    assert.equal(result.ok, true);
    assert.equal(result.status, "CONFIRMED");
    assert.equal(result.transferRef, "TR-OK-1");
    resetMiceTransferBookFetcherForTests();
  });

  it("response without confirmationRef is DATA_UNAVAILABLE", async () => {
    process.env.NODE_ENV = "test";
    setMiceTransferBookFetcherForTests(async () => ({ status: "ok" }));
    const result = await attemptMiceTransferBooking({ transferId: "t1" });
    assert.equal(result.status, "DATA_UNAVAILABLE");
    assert.equal(result.transferRef, null);
    resetMiceTransferBookFetcherForTests();
  });
});

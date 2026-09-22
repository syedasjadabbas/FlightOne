/**
 * Regression test for the Express `res.cookie()` maxAge unit mismatch:
 * Express treats `maxAge` as milliseconds (it does `Math.floor(maxAge / 1000)`
 * internally), the opposite of the raw `cookie` package's seconds-based
 * `serialize()`. Passing seconds here once silently produced a refresh
 * cookie that expired in ~10 minutes instead of 7 days.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { refreshCookieOptions } from "./auth.cookies.js";

describe("auth.cookies.refreshCookieOptions", () => {
  it("returns maxAge in milliseconds for the default 7-day expiry", () => {
    const opts = refreshCookieOptions({});
    assert.equal(opts.maxAge, 7 * 86400 * 1000);
  });

  it("returns maxAge in milliseconds when JWT_REFRESH_COOKIE_MAX_AGE_DAYS is set", () => {
    const opts = refreshCookieOptions({ JWT_REFRESH_COOKIE_MAX_AGE_DAYS: "3" });
    assert.equal(opts.maxAge, 3 * 86400 * 1000);
  });

  it("falls back to the 7-day default for an invalid override", () => {
    const opts = refreshCookieOptions({ JWT_REFRESH_COOKIE_MAX_AGE_DAYS: "not-a-number" });
    assert.equal(opts.maxAge, 7 * 86400 * 1000);
  });
});

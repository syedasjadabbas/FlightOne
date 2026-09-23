import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The demo bypass disables real financial controls (credit limit, policy,
 * approval), so the gate around it is what matters. These assertions are
 * static — they need no DB — and fail loudly if the production guard is ever
 * dropped or the bypass is moved above the membership check.
 */
const SOURCE = readFileSync(
  fileURLToPath(new URL("./corporate.service.js", import.meta.url)),
  "utf8",
);

describe("corporate demo bypass gate", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevDemo = process.env.DEMO_FLIGHT_INVENTORY;
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevDemo === undefined) delete process.env.DEMO_FLIGHT_INVENTORY;
    else process.env.DEMO_FLIGHT_INVENTORY = prevDemo;
  });

  it("requires BOTH non-production and the demo flag", () => {
    const guard = SOURCE.match(
      /function isDemoBookingEnabled\(\)\s*\{[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(guard, "isDemoBookingEnabled must exist");
    assert.match(guard, /NODE_ENV\s*!==\s*"production"/);
    assert.match(guard, /DEMO_FLIGHT_INVENTORY\s*===\s*"true"/);
    // An `||` here would let the flag alone open the gate in production.
    assert.ok(!/\|\|/.test(guard), "guard must AND its conditions, never OR");
  });

  it("still verifies membership and company-active before bypassing", () => {
    // Slice from the declaration to the next top-level `export`, not a lazy
    // `\n}` — the function contains nested blocks that end the match early.
    const start = SOURCE.indexOf("export async function assertCorporateBookingAllowed");
    assert.ok(start > -1, "assertCorporateBookingAllowed must exist");
    const next = SOURCE.indexOf("\nexport ", start + 1);
    const fn = SOURCE.slice(start, next > -1 ? next : SOURCE.length);

    const membershipAt = fn.indexOf("requireCompanyMembership");
    const activeAt = fn.indexOf("Company account is not active");
    const bypassAt = fn.indexOf("isDemoBookingEnabled");

    assert.ok(membershipAt > -1 && activeAt > -1 && bypassAt > -1);
    // A forged companyId must still be rejected in demo mode.
    assert.ok(membershipAt < bypassAt, "membership check must precede the bypass");
    assert.ok(activeAt < bypassAt, "company-active check must precede the bypass");
  });

  it("leaves the real spend checks in place for the non-demo path", () => {
    assert.match(SOURCE, /Corporate credit limit exceeded/);
    assert.match(SOURCE, /APPROVAL_REQUIRED/);
  });
});

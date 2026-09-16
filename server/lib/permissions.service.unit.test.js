/**
 * RBAC companyId fallthrough regression tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasPermissionEff } from "./permissions.service.js";
import { requirePermission } from "../middlewares/permission.js";

describe("hasPermissionEff — company isolation", () => {
  const eff = {
    global: ["ops:dashboard:read"],
    byCompany: {
      coA: ["corporate:company:write", "refunds:read"],
      coB: ["refunds:write"],
    },
  };

  it("grants global permission without companyId", () => {
    assert.equal(hasPermissionEff(eff, "ops:dashboard:read"), true);
    assert.equal(hasPermissionEff(eff, "ops:dashboard:read", null), true);
  });

  it("grants company permission for the correct company", () => {
    assert.equal(hasPermissionEff(eff, "corporate:company:write", "coA"), true);
    assert.equal(hasPermissionEff(eff, "refunds:write", "coB"), true);
  });

  it("denies company permission for the wrong company", () => {
    assert.equal(hasPermissionEff(eff, "corporate:company:write", "coB"), false);
    assert.equal(hasPermissionEff(eff, "refunds:write", "coA"), false);
  });

  it("denies company-scoped permission when companyId is missing (no fallthrough)", () => {
    assert.equal(hasPermissionEff(eff, "corporate:company:write"), false);
    assert.equal(hasPermissionEff(eff, "refunds:read"), false);
    assert.equal(hasPermissionEff(eff, "refunds:write", undefined), false);
  });

  it("allowAnyCompany opt-in restores intentional cross-company admin checks", () => {
    assert.equal(
      hasPermissionEff(eff, "corporate:company:write", undefined, { allowAnyCompany: true }),
      true,
    );
  });

  it("denies unknown keys", () => {
    assert.equal(hasPermissionEff(eff, "nope:key", "coA"), false);
    assert.equal(hasPermissionEff(null, "ops:dashboard:read"), false);
  });
});

describe("requirePermission — requireCompanyId", () => {
  function run(mw, req) {
    return new Promise((resolve) => {
      mw(req, {}, (err) => resolve(err ?? null));
    });
  }

  it("denies when requireCompanyId and companyId missing even if company grant exists", async () => {
    const mw = requirePermission("corporate:company:write", {
      companyIdFrom: "params",
      requireCompanyId: true,
    });
    const err = await run(mw, {
      user: { id: "u1" },
      permissions: {
        global: [],
        byCompany: { coA: ["corporate:company:write"] },
      },
      params: {},
      query: {},
      body: {},
    });
    assert.equal(err?.statusCode, 403);
  });

  it("grants when companyId matches company-scoped permission", async () => {
    const mw = requirePermission("corporate:company:write", {
      companyIdFrom: "params",
      requireCompanyId: true,
    });
    const err = await run(mw, {
      user: { id: "u1" },
      permissions: {
        global: [],
        byCompany: { coA: ["corporate:company:write"] },
      },
      params: { companyId: "coA" },
      query: {},
      body: {},
    });
    assert.equal(err, null);
  });

  it("denies IDOR — wrong companyId", async () => {
    const mw = requirePermission("corporate:company:write", {
      companyIdFrom: "params",
      requireCompanyId: true,
    });
    const err = await run(mw, {
      user: { id: "u1" },
      permissions: {
        global: [],
        byCompany: { coA: ["corporate:company:write"] },
      },
      params: { companyId: "coOther" },
      query: {},
      body: {},
    });
    assert.equal(err?.statusCode, 403);
  });
});

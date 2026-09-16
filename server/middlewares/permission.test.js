/**
 * Unit tests for requirePermission / requireAnyPermission middleware.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireAnyPermission, requirePermission } from "./permission.js";

function mockReq({ user, permissions } = {}) {
  return { user, permissions, params: {}, query: {}, body: {} };
}

function run(mw, req) {
  return new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err ?? null));
  });
}

describe("requireAnyPermission", () => {
  it("grants access when permission A is present", async () => {
    const mw = requireAnyPermission(["knowledge:write", "ops:dashboard:read"]);
    const err = await run(
      mw,
      mockReq({ user: { id: "u1" }, permissions: { global: ["knowledge:write"], byCompany: {} } }),
    );
    assert.equal(err, null);
  });

  it("grants access when permission B is present", async () => {
    const mw = requireAnyPermission(["knowledge:write", "ops:dashboard:read"]);
    const err = await run(
      mw,
      mockReq({
        user: { id: "u1" },
        permissions: { global: ["ops:dashboard:read"], byCompany: {} },
      }),
    );
    assert.equal(err, null);
  });

  it("denies when neither permission is present", async () => {
    const mw = requireAnyPermission(["knowledge:write", "ops:dashboard:read"]);
    const err = await run(
      mw,
      mockReq({ user: { id: "u1" }, permissions: { global: ["refunds:read"], byCompany: {} } }),
    );
    assert.equal(err?.statusCode, 403);
  });

  it("unauthenticated request remains unauthorized", async () => {
    const mw = requireAnyPermission(["knowledge:write"]);
    const err = await run(mw, mockReq({}));
    assert.equal(err?.statusCode, 401);
  });

  it("honors internal Set wildcard", async () => {
    const mw = requireAnyPermission(["dashboard:read"]);
    const err = await run(mw, mockReq({ user: { id: "internal" }, permissions: new Set(["*"]) }));
    assert.equal(err, null);
  });
});

describe("requirePermission", () => {
  it("denies missing single permission", async () => {
    const mw = requirePermission("ops:dashboard:read");
    const err = await run(
      mw,
      mockReq({ user: { id: "u1" }, permissions: { global: [], byCompany: {} } }),
    );
    assert.equal(err?.statusCode, 403);
  });

  it("grants matching single permission", async () => {
    const mw = requirePermission("ops:dashboard:read");
    const err = await run(
      mw,
      mockReq({
        user: { id: "u1" },
        permissions: { global: ["ops:dashboard:read"], byCompany: {} },
      }),
    );
    assert.equal(err, null);
  });
});

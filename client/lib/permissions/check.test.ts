import { describe, expect, it } from "vitest";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermissionKey,
} from "@/lib/permissions/check";

const perms = {
  global: ["ops:dashboard:read", "refunds:write"],
  byCompany: {
    co1: ["corporate:company:write"],
  },
};

describe("permission check helpers", () => {
  it("matches global keys", () => {
    expect(hasPermissionKey(perms, "ops:dashboard:read")).toBe(true);
    expect(hasPermissionKey(perms, "knowledge:read")).toBe(false);
  });

  it("matches company-scoped keys", () => {
    expect(hasPermissionKey(perms, "corporate:company:write", "co1")).toBe(true);
    expect(hasPermissionKey(perms, "corporate:company:write", "co2")).toBe(false);
    expect(hasPermissionKey(perms, "corporate:company:write")).toBe(true);
  });

  it("hasAny / hasAll", () => {
    expect(hasAnyPermission(perms, ["dashboard:read", "ops:dashboard:read"])).toBe(true);
    expect(hasAnyPermission(perms, ["dashboard:read", "knowledge:read"])).toBe(false);
    expect(hasAllPermissions(perms, ["ops:dashboard:read", "refunds:write"])).toBe(true);
    expect(hasAllPermissions(perms, ["ops:dashboard:read", "knowledge:read"])).toBe(false);
  });
});

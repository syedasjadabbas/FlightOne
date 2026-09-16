/**
 * Module 13 — consultant routing unit tests.
 * Run: node --test modules/escalations/escalations.routing.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ROUTING_POOLS,
  ROUTING_STATUSES,
  getLanguagePermissionMap,
  resolveRoutingTarget,
  toPublicRouting,
} from "./escalations.routing.js";

describe("Module 13 consultant routing (unit)", () => {
  it("routes VIP triggers to VIP pool with vip permission", () => {
    const t = resolveRoutingTarget({ trigger: "VIP_BOOKING", priority: 2 });
    assert.equal(t.pool, ROUTING_POOLS.VIP);
    assert.ok(t.requiredPermissions.includes("ops:escalations:write"));
    assert.ok(t.requiredPermissions.includes("ops:escalations:vip"));
  });

  it("routes medical / SSR to medical pool", () => {
    const med = resolveRoutingTarget({ trigger: "MEDICAL_ASSISTANCE", priority: 3 });
    assert.equal(med.pool, ROUTING_POOLS.MEDICAL);
    assert.ok(med.requiredPermissions.includes("ops:escalations:medical"));

    const ssr = resolveRoutingTarget({ trigger: "SSR", priority: 1 });
    assert.equal(ssr.pool, ROUTING_POOLS.MEDICAL);
  });

  it("routes customer request to general pool", () => {
    const t = resolveRoutingTarget({ trigger: "CUSTOMER_REQUEST", priority: 0 });
    assert.equal(t.pool, ROUTING_POOLS.GENERAL);
    assert.deepEqual(t.requiredPermissions, ["ops:escalations:write"]);
  });

  it("adds language permission only when env map is configured", () => {
    const without = resolveRoutingTarget({
      trigger: "CUSTOMER_REQUEST",
      preferredLanguage: "ur",
      env: {},
    });
    assert.equal(without.languagePermission, null);
    assert.equal(without.requiredPermissions.length, 1);

    const withMap = resolveRoutingTarget({
      trigger: "CUSTOMER_REQUEST",
      preferredLanguage: "ur",
      env: { ESCALATION_LANGUAGE_PERMISSION_MAP: "ur:ops:escalations:lang:ur" },
    });
    assert.equal(withMap.languagePermission, "ops:escalations:lang:ur");
    assert.ok(withMap.requiredPermissions.includes("ops:escalations:lang:ur"));
  });

  it("parses language permission map without inventing entries", () => {
    assert.deepEqual(getLanguagePermissionMap({}), {});
    assert.deepEqual(
      getLanguagePermissionMap({
        ESCALATION_LANGUAGE_PERMISSION_MAP: "en:ops:escalations:lang:en",
      }),
      { en: "ops:escalations:lang:en" },
    );
  });

  it("public routing never claims availability or auto-assignment", () => {
    const pub = toPublicRouting({
      pool: "VIP",
      status: ROUTING_STATUSES.UNROUTED_NO_ELIGIBLE,
      eligibleConsultantCount: 0,
      _eligibleConsultantIds: ["secret-user"],
      reason: "VIP pool",
      routedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(pub.availabilityClaimed, false);
    assert.equal(pub.autoAssigned, false);
    assert.equal(pub._eligibleConsultantIds, undefined);
    assert.equal(pub.eligibleConsultantCount, 0);
    assert.equal(pub.status, ROUTING_STATUSES.UNROUTED_NO_ELIGIBLE);
  });
});

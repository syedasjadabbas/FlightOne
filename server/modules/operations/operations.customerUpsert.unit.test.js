/**
 * Module 15 — CUSTOMER_UPSERTED producer unit tests (no DB).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeCustomerUpsertPayload,
  buildCustomerUpsertPayload,
  CUSTOMER_UPSERT_SOURCES,
  hashCustomerUpsertPayload,
  isMaterialProfileChange,
  stableStringify,
} from "./integrations/crm/customerUpsert.producer.js";

describe("CUSTOMER_UPSERTED producer (unit)", () => {
  it("builds CRM-safe payload with required fields and company context", () => {
    const payload = buildCustomerUpsertPayload({
      user: {
        id: "u1",
        email: "a@example.com",
        name: "Ada",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      profile: {
        displayName: "Ada Lovelace",
        phone: "+10000000000",
        nationality: "PK",
        preferredCabin: "ECONOMY",
        seatPref: "AISLE",
        mealPref: "VEG",
        preferredAirlines: ["PK"],
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      companyIds: ["co-b", "co-a", "co-a"],
      source: CUSTOMER_UPSERT_SOURCES.PROFILE_UPDATE,
    });

    assert.equal(payload.userId, "u1");
    assert.equal(payload.email, "a@example.com");
    assert.equal(payload.name, "Ada");
    assert.equal(payload.displayName, "Ada Lovelace");
    assert.equal(payload.phone, "+10000000000");
    assert.deepEqual(payload.companyIds, ["co-a", "co-b"]);
    assert.equal(payload.source, "profile.update");
    assert.equal(payload.updatedAt, "2026-01-02T00:00:00.000Z");
    assertSafeCustomerUpsertPayload(payload);
  });

  it("excludes sensitive fields from payload builder inputs", () => {
    const payload = buildCustomerUpsertPayload({
      user: {
        id: "u2",
        email: "b@example.com",
        name: "Bob",
        passwordHash: "SHOULD_NOT_APPEAR",
        updatedAt: new Date(),
      },
      profile: {
        displayName: "Bob",
        metadata: { secret: "nope", passwordHash: "x" },
        updatedAt: new Date(),
      },
      companyIds: [],
      source: CUSTOMER_UPSERT_SOURCES.REGISTER,
    });
    const json = JSON.stringify(payload);
    assert.equal(json.includes("SHOULD_NOT_APPEAR"), false);
    assert.equal(json.includes("passwordHash"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "metadata"), false);
    assertSafeCustomerUpsertPayload(payload);
  });

  it("detects material profile changes only", () => {
    const before = { displayName: "A", phone: null, nationality: "PK" };
    const afterPhone = { displayName: "A", phone: "+1", nationality: "PK" };
    assert.equal(isMaterialProfileChange(before, afterPhone, { phone: "+1" }), true);
    assert.equal(isMaterialProfileChange(before, before, { phone: null }), false);
    assert.equal(
      isMaterialProfileChange(before, { ...before, metadata: { x: 1 } }, { metadata: { x: 1 } }),
      false,
    );
  });

  it("content hash is stable for idempotency", () => {
    const a = { userId: "u", email: "e", preferredAirlines: ["B", "A"], companyIds: ["2", "1"] };
    const b = { companyIds: ["2", "1"], preferredAirlines: ["B", "A"], email: "e", userId: "u" };
    assert.equal(hashCustomerUpsertPayload(a), hashCustomerUpsertPayload(b));
    assert.notEqual(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 3 }));
  });
});

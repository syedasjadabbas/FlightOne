/**
 * Profile completeness + validator unit tests (no DB).
 * Run: node --test modules/profile/profile.unit.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { computeProfileCompleteness } from "./profile.service.js";
import {
  updateProfileSchema,
  createIdentityDocumentSchema,
  createEmergencyContactSchema,
  createCompanionSchema,
} from "./profile.validators.js";

describe("computeProfileCompleteness", () => {
  it("flags missing passport and emergency contact", () => {
    const c = computeProfileCompleteness(
      {
        displayName: "Ada",
        phone: "+92",
        seatPref: "aisle",
        mealPref: "vegetarian",
        preferredAirlines: ["EY"],
      },
      { hasPassport: false, hasEmergencyContact: false },
    );
    assert.equal(c.readyForHandsFreeBooking, false);
    assert.ok(c.missing.includes("passport"));
    assert.ok(c.missing.includes("emergencyContact"));
    assert.equal(c.score, 71);
  });

  it("is ready when all foundation fields present", () => {
    const c = computeProfileCompleteness(
      {
        displayName: "Ada",
        phone: "+92",
        seatPref: "window",
        mealPref: "halal",
        preferredAirlines: ["PK"],
      },
      { hasPassport: true, hasEmergencyContact: true },
    );
    assert.equal(c.readyForHandsFreeBooking, true);
    assert.deepEqual(c.missing, []);
    assert.equal(c.score, 100);
  });
});

describe("profile validators — invalid input", () => {
  it("rejects unknown profile fields", () => {
    assert.throws(
      () => updateProfileSchema.parse({ displayName: "A", hack: true }),
      ZodError,
    );
  });

  it("rejects invalid nationality length", () => {
    assert.throws(() => updateProfileSchema.parse({ nationality: "PAK" }), ZodError);
  });

  it("rejects invalid document type", () => {
    assert.throws(
      () => createIdentityDocumentSchema.parse({ type: "DRIVER_LICENSE" }),
      ZodError,
    );
  });

  it("rejects emergency contact without phone", () => {
    assert.throws(
      () => createEmergencyContactSchema.parse({ fullName: "Mom" }),
      ZodError,
    );
  });

  it("accepts family companion kind", () => {
    const parsed = createCompanionSchema.parse({
      fullName: "Child",
      kind: "FAMILY",
      relationship: "child",
    });
    assert.equal(parsed.kind, "FAMILY");
  });

  it("normalizes country codes on documents", () => {
    const parsed = createIdentityDocumentSchema.parse({
      type: "PASSPORT",
      countryCode: "pk",
      documentNumber: "AB1234567",
    });
    assert.equal(parsed.countryCode, "PK");
  });
});

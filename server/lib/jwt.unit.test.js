/**
 * JWT access-token defaults (Module 00).
 * Run: node --test lib/jwt.unit.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

describe("signAccessToken defaults", () => {
  const prevSecret = process.env.JWT_SECRET;
  const prevExp = process.env.JWT_ACCESS_EXPIRES_IN;

  before(() => {
    process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long!!";
    delete process.env.JWT_ACCESS_EXPIRES_IN;
  });

  after(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
    if (prevExp === undefined) delete process.env.JWT_ACCESS_EXPIRES_IN;
    else process.env.JWT_ACCESS_EXPIRES_IN = prevExp;
  });

  it("defaults access TTL to 15m when JWT_ACCESS_EXPIRES_IN unset", async () => {
    const { signAccessToken } = await import("./jwt.js");
    const token = signAccessToken({ sub: "u1", email: "a@b.co" });
    const decoded = jwt.decode(token);
    assert.ok(decoded?.iat && decoded?.exp);
    const ttlSec = decoded.exp - decoded.iat;
    assert.ok(ttlSec >= 14 * 60 && ttlSec <= 16 * 60, `ttlSec=${ttlSec}`);
  });

  it("honors explicit expiresIn argument", async () => {
    const { signAccessToken } = await import("./jwt.js");
    const token = signAccessToken({ sub: "u1", email: "a@b.co" }, "1h");
    const decoded = jwt.decode(token);
    const ttlSec = decoded.exp - decoded.iat;
    assert.ok(ttlSec >= 55 * 60 && ttlSec <= 65 * 60, `ttlSec=${ttlSec}`);
  });

  it("honors JWT_ACCESS_EXPIRES_IN env override", async () => {
    process.env.JWT_ACCESS_EXPIRES_IN = "30m";
    const { signAccessToken } = await import("./jwt.js");
    const token = signAccessToken({ sub: "u1", email: "a@b.co" });
    const decoded = jwt.decode(token);
    const ttlSec = decoded.exp - decoded.iat;
    assert.ok(ttlSec >= 29 * 60 && ttlSec <= 31 * 60, `ttlSec=${ttlSec}`);
    delete process.env.JWT_ACCESS_EXPIRES_IN;
  });
});

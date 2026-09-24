import { describe, expect, it } from "vitest";
import { isCredentialRequest } from "./baseApi";

describe("isCredentialRequest", () => {
  it("never refreshes on a wrong-password 401", () => {
    expect(isCredentialRequest({ url: "/auth/login", method: "POST" })).toBe(true);
    expect(isCredentialRequest({ url: "/auth/2fa/verify", method: "POST" })).toBe(true);
    expect(isCredentialRequest("/auth/refresh")).toBe(true);
  });

  it("still refreshes on expired-token 401s from protected endpoints", () => {
    expect(isCredentialRequest("/auth/me")).toBe(false);
    expect(isCredentialRequest({ url: "/bookings?page=1" })).toBe(false);
  });
});

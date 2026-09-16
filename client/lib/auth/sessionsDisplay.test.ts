import { describe, expect, it } from "vitest";
import { authApi } from "@/lib/api/auth.api";
import {
  formatSessionWhen,
  sessionHasTokenLeak,
  sessionsUiState,
} from "@/lib/auth/sessionsDisplay";

describe("auth.api session endpoints", () => {
  it("registers session list/revoke mutations", () => {
    const endpoints = Object.keys(authApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "listSessions",
        "revokeSession",
        "revokeOtherSessions",
      ]),
    );
  });
});

describe("sessions UI states", () => {
  it("maps loading, error, empty, ready, and success states", () => {
    expect(
      sessionsUiState({ isLoading: true, isError: false, sessionCount: 0 }),
    ).toBe("loading");
    expect(
      sessionsUiState({ isLoading: false, isError: true, sessionCount: 0 }),
    ).toBe("error");
    expect(
      sessionsUiState({ isLoading: false, isError: false, sessionCount: 0 }),
    ).toBe("empty");
    expect(
      sessionsUiState({ isLoading: false, isError: false, sessionCount: 2 }),
    ).toBe("ready");
    expect(
      sessionsUiState({
        isLoading: false,
        isError: false,
        sessionCount: 1,
        justRevoked: true,
      }),
    ).toBe("success_revoke");
    expect(
      sessionsUiState({
        isLoading: false,
        isError: false,
        sessionCount: 1,
        justRevokedOthers: true,
      }),
    ).toBe("success_revoke_others");
  });

  it("formats timestamps safely", () => {
    expect(formatSessionWhen(null)).toBe("—");
    expect(formatSessionWhen("not-a-date")).toBe("—");
    expect(formatSessionWhen("2026-09-07T10:00:00.000Z")).not.toBe("—");
  });

  it("detects token leakage in payloads", () => {
    expect(sessionHasTokenLeak({ sessions: [{ id: "1" }] })).toBe(false);
    expect(sessionHasTokenLeak({ tokenHash: "abc" })).toBe(true);
    expect(sessionHasTokenLeak({ refreshToken: "secret" })).toBe(true);
  });
});

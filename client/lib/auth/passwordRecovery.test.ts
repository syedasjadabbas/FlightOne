import { describe, expect, it } from "vitest";
import { authApi } from "@/lib/api/auth.api";
import {
  forgotPasswordUiState,
  resetPasswordUiState,
  validateForgotPasswordEmail,
  validateResetPasswordInput,
} from "@/lib/auth/passwordRecovery";

describe("auth.api password recovery endpoints", () => {
  it("registers forgot/reset mutations without session write on request", () => {
    const endpoints = Object.keys(authApi.endpoints);
    expect(endpoints).toEqual(
      expect.arrayContaining([
        "login",
        "register",
        "forgotPassword",
        "resetPassword",
        "refresh",
        "logout",
        "me",
      ]),
    );
  });
});

describe("forgot-password client validation & UI states", () => {
  it("accepts a valid email submission payload", () => {
    expect(validateForgotPasswordEmail("ava@example.com")).toBeNull();
  });

  it("rejects empty and invalid emails", () => {
    expect(validateForgotPasswordEmail("")).toMatch(/email/i);
    expect(validateForgotPasswordEmail("not-an-email")).toMatch(/valid email/i);
  });

  it("maps loading, queued success, and unconfigured provider states", () => {
    expect(
      forgotPasswordUiState({
        isLoading: true,
        submitted: false,
        hasError: false,
      }),
    ).toBe("loading");
    expect(
      forgotPasswordUiState({
        isLoading: false,
        submitted: true,
        emailDelivery: "QUEUED",
        hasError: false,
      }),
    ).toBe("success_queued");
    expect(
      forgotPasswordUiState({
        isLoading: false,
        submitted: true,
        emailDelivery: "UNCONFIGURED",
        hasError: false,
      }),
    ).toBe("success_unconfigured");
  });
});

describe("reset-password client validation & UI states", () => {
  it("validates new/confirm password rules", () => {
    expect(
      validateResetPasswordInput({
        token: "abc",
        password: "securepass",
        confirmPassword: "securepass",
      }),
    ).toBeNull();
    expect(
      validateResetPasswordInput({
        token: "",
        password: "securepass",
        confirmPassword: "securepass",
      }),
    ).toBe("missing_token");
    expect(
      validateResetPasswordInput({
        token: "abc",
        password: "short",
        confirmPassword: "short",
      }),
    ).toBe("weak_password");
    expect(
      validateResetPasswordInput({
        token: "abc",
        password: "securepass",
        confirmPassword: "different1",
      }),
    ).toBe("mismatch");
  });

  it("maps success, invalid/expired token, and missing token states", () => {
    expect(
      resetPasswordUiState({
        token: "tok",
        isLoading: false,
        succeeded: true,
        hasError: false,
      }),
    ).toBe("success");
    expect(
      resetPasswordUiState({
        token: "tok",
        isLoading: false,
        succeeded: false,
        errorStatus: 400,
        hasError: true,
      }),
    ).toBe("invalid_token");
    expect(
      resetPasswordUiState({
        token: "",
        isLoading: false,
        succeeded: false,
        hasError: false,
      }),
    ).toBe("missing_token");
    expect(
      resetPasswordUiState({
        token: "tok",
        isLoading: true,
        succeeded: false,
        hasError: false,
      }),
    ).toBe("loading");
  });
});

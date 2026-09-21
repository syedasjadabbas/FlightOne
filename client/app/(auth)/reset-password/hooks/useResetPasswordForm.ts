"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useResetPasswordMutation } from "@/lib/api/auth.api";

/** Colocated to `/reset-password` only. */
export function useResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = (searchParams.get("email") || "").trim();
  const initialToken = (searchParams.get("token") || searchParams.get("code") || "").trim();

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const trimmedCode = token.trim();
    if (!trimmedCode || trimmedCode.length < 6) {
      setLocalError("Please enter the 6-digit verification code.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({
        email: email.trim() || undefined,
        token: trimmedCode,
        password,
      }).unwrap();
      setSucceeded(true);
    } catch {
      // Surfaces via RTK error below.
    }
  }

  const errorStatus =
    error && "status" in error && typeof error.status === "number"
      ? error.status
      : null;

  const uiState = succeeded
    ? "success"
    : isLoading
      ? "loading"
      : errorStatus === 400
        ? "invalid_token"
        : error
          ? "error"
          : "idle";

  const errorMessage =
    localError ||
    (errorStatus === 400
      ? "Invalid or expired verification code. Please check your email or request a new code."
      : error
        ? "Something went wrong — please try again."
        : null);

  return {
    email,
    setEmail,
    token,
    setToken,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    handleSubmit,
    isLoading,
    errorMessage,
    uiState,
    isEmailLocked: Boolean(initialEmail),
  };
}

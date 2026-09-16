"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForgotPasswordMutation } from "@/lib/api/auth.api";
import type { PasswordResetEmailDelivery } from "@/lib/api/auth.api";
import {
  forgotPasswordUiState,
  validateForgotPasswordEmail,
} from "@/lib/auth/passwordRecovery";

/** Colocated to `/forgot-password` only. */
export function useForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailDelivery, setEmailDelivery] =
    useState<PasswordResetEmailDelivery | null>(null);
  const [forgotPassword, { isLoading, error }] = useForgotPasswordMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setSubmitted(false);
    setEmailDelivery(null);

    const validationError = validateForgotPasswordEmail(email);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      const data = await forgotPassword({ email: email.trim() }).unwrap();
      setEmailDelivery(data.emailDelivery);
      setSubmitted(true);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch {
      // Surfaces via RTK error below.
    }
  }

  const uiState = forgotPasswordUiState({
    isLoading,
    submitted,
    emailDelivery,
    hasError: Boolean(error) && !localError,
  });

  const errorMessage =
    localError ||
    (error
      ? "Something went wrong — please try again."
      : null);

  return {
    email,
    setEmail,
    handleSubmit,
    isLoading,
    errorMessage,
    uiState,
    emailDelivery,
  };
}

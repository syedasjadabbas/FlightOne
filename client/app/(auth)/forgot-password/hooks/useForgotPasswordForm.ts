"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForgotPasswordMutation } from "@/lib/api/auth.api";
import type { PasswordResetEmailDelivery } from "@/lib/api/auth.api";
import { formatApiError } from "@/lib/api/formatApiError";
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
      // Stay on-page when mail is unconfigured so staff see the honest warning.
      // Otherwise continue to enter the one-time code.
      if (data.emailDelivery !== "UNCONFIGURED") {
        router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
      }
    } catch (err: unknown) {
      setLocalError(formatApiError(err, "Something went wrong — please try again."));
    }
  }

  const uiState = forgotPasswordUiState({
    isLoading,
    submitted,
    emailDelivery,
    hasError: Boolean(error || localError) && !submitted,
  });

  const errorMessage =
    localError ||
    (error && !submitted
      ? formatApiError(error, "Something went wrong — please try again.")
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

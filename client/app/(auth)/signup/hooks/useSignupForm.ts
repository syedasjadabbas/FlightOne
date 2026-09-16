"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
} from "@/lib/api/auth.api";
import { useAttachReferralMutation } from "@/lib/api/rewards.api";
import { useAuthStore } from "@/store/auth.store";

const MIN_PASSWORD = 8;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Colocated to `/signup` only. */
export function useSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramEmail = searchParams.get("email") || "";
  const paramStep = searchParams.get("step");

  const [step, setStep] = useState<"signup" | "verify">(
    paramStep === "verify" && paramEmail ? "verify" : "signup"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [register, { isLoading: isRegistering, error: registerError }] = useRegisterMutation();
  const [verifyEmail, { isLoading: isVerifying, error: verifyError }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();
  const [attachReferral] = useAttachReferralMutation();

  const isLoading = isRegistering || isVerifying || isResending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setLocalError("Please enter your name.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setLocalError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    try {
      const res = await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
      }).unwrap();

      if (res.requiresVerification) {
        setStep("verify");
        setInfoMessage(`A 6-digit verification code was sent to ${trimmedEmail}.`);
      }
    } catch {
      // Handled via errorMessage logic below
    }
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setLocalError("Please enter the 6-digit verification code.");
      return;
    }

    try {
      const session = await verifyEmail({
        email: email.trim(),
        code: trimmedCode,
      }).unwrap();

      useAuthStore.getState().setSession(session);

      const refCode = (searchParams.get("ref") || "").trim().toUpperCase();
      if (refCode) {
        try {
          await attachReferral({ code: refCode }).unwrap();
        } catch {
          // Non-blocking
        }
      }

      router.replace(searchParams.get("redirect") || "/chat");
    } catch {
      // Handled via errorMessage logic below
    }
  }

  async function handleResendCode() {
    setLocalError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError("Email address is required.");
      return;
    }

    try {
      await resendVerification({ email: trimmedEmail }).unwrap();
      setInfoMessage(`A new 6-digit verification code has been sent to ${trimmedEmail}.`);
    } catch (err: any) {
      if (err?.status === 429) {
        setLocalError("Please wait a minute before requesting another code.");
      } else {
        setLocalError(err?.data?.message || "Failed to resend code. Please try again.");
      }
    }
  }

  const registerErrorKind = !registerError
    ? null
    : "status" in registerError && registerError.status === 409
      ? "duplicate"
      : "status" in registerError && registerError.status === 400
        ? "validation"
        : "unknown";

  const verifyErrorMessage = !verifyError
    ? null
    : "status" in verifyError && verifyError.status === 429
      ? (verifyError.data as any)?.message || "Too many failed attempts. Please request a new code."
      : "status" in verifyError && verifyError.status === 400
        ? "Invalid or expired verification code."
        : "Something went wrong — please try again.";

  const errorMessage =
    localError ||
    verifyErrorMessage ||
    (registerErrorKind === "duplicate"
      ? "An account with this email already exists. Try logging in."
      : registerErrorKind === "validation"
        ? "Please check your details and try again."
        : registerErrorKind === "unknown"
          ? "Something went wrong — please try again."
          : null);

  return {
    step,
    setStep,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    code,
    setCode,
    handleSubmit,
    handleVerifySubmit,
    handleResendCode,
    isLoading,
    isResending,
    errorMessage,
    infoMessage,
  };
}

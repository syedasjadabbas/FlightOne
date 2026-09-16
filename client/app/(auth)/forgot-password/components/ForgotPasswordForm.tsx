"use client";

import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useForgotPasswordForm } from "../hooks/useForgotPasswordForm";

/** Colocated to `/forgot-password` — matches login visual language. */
export function ForgotPasswordForm() {
  const { email, setEmail, handleSubmit, isLoading, errorMessage, uiState } =
    useForgotPasswordForm();

  if (uiState === "success_queued" || uiState === "success_unconfigured") {
    return (
      <AuthPanel
        title="Check your email"
        leadRole="status"
        lead={
          uiState === "success_queued"
            ? "If an account exists for that address, we sent password reset instructions. The link expires soon and can only be used once."
            : "If an account exists for that address, a reset was prepared. Email delivery is not configured on this environment, so a message was not sent. Ask your administrator to enable email delivery, or use a reset link from a configured environment."
        }
        footer={
          <p>
            <Link href="/login" className="fo-auth__link">
              Back to log in
            </Link>
          </p>
        }
      />
    );
  }

  return (
    <AuthPanel
      title="Reset password"
      lead="Enter your email. We'll send a 6-digit verification code."
      footer={
        <p>
          <Link href="/login" className="fo-auth__link">
            Back to log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isLoading}
        />

        {errorMessage && (
          <p className="fo-auth__alert anim-alert" role="alert">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
          {isLoading ? (
            <>
              <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
              Sending code…
            </>
          ) : (
            "Send verification code"
          )}
        </Button>
      </form>
    </AuthPanel>
  );
}

"use client";

import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useResetPasswordForm } from "../hooks/useResetPasswordForm";

/** Colocated to `/reset-password` — matches login visual language. */
export function ResetPasswordForm() {
  const {
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
    isEmailLocked,
  } = useResetPasswordForm();

  if (uiState === "success") {
    return (
      <AuthPanel
        title="Password updated"
        leadRole="status"
        lead="Your password was changed successfully. Log in with your new password."
        footer={
          <p>
            <Link href="/login" className="fo-auth__link">
              Log in
            </Link>
          </p>
        }
      />
    );
  }

  return (
    <AuthPanel
      title="Verify code & reset password"
      lead={
        isEmailLocked
          ? `Enter the 6-digit code sent to ${email} along with your new password.`
          : "Enter the 6-digit code sent to your email along with your new password."
      }
      footer={
        <p>
          Need a code?{" "}
          <Link href="/forgot-password" className="fo-auth__link">
            {isEmailLocked ? "Change email or request new code" : "Request a new code"}
          </Link>
          <span className="fo-auth__sep" aria-hidden>
            ·
          </span>
          <Link href="/login" className="fo-auth__link">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
          <Input
            label={isEmailLocked ? "Email (confirmed)" : "Email"}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            readOnly={isEmailLocked}
            className={isEmailLocked ? "bg-slate-50 text-ink-soft cursor-default select-all" : undefined}
          />

          <Input
            label="6-Digit Verification Code"
            type="text"
            required
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            disabled={isLoading}
          />

          <Input
            label="New password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            disabled={isLoading}
          />

          <Input
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>

        {errorMessage && (
          <p className="fo-auth__alert anim-alert" role="alert">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
          {isLoading ? (
            <>
              <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
              Resetting password…
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthPanel>
  );
}

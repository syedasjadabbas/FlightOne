"use client";

import Link from "next/link";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useResetPasswordForm } from "../hooks/useResetPasswordForm";

/** Colocated to `/reset-password` — code + new password, one job. */
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
        lead="You can log in with your new password."
        footer={
          <p>
            <Link href="/login" className="fo-auth__link">
              Log in
            </Link>
          </p>
        }
      >
        <CheckCircle2
          className="size-6 text-sky"
          strokeWidth={1.75}
          aria-hidden
        />
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Set a new password"
      lead={
        isEmailLocked
          ? `Enter the code sent to ${email}, then choose a new password.`
          : "Enter the 6-digit code from your email, then choose a new password."
      }
      footer={
        <p>
          Need a code?{" "}
          <Link href="/forgot-password" className="fo-auth__link">
            {isEmailLocked ? "Request a new one" : "Request a code"}
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
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@email.com"
          disabled={isLoading}
          readOnly={isEmailLocked}
          className={
            isEmailLocked
              ? "cursor-default select-all bg-paper-elevated text-ink-soft"
              : undefined
          }
          hint={isEmailLocked ? "From your reset link" : undefined}
        />

        <Input
          label="Verification code"
          type="text"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          disabled={isLoading}
          className="font-mono text-center text-lg tracking-[0.35em] tabular-nums"
        />

        <div
          className="my-0.5 flex items-center gap-2"
          aria-hidden
        >
          <span className="h-px flex-1 bg-[color-mix(in_oklab,var(--navy)_8%,transparent)]" />
          <KeyRound className="size-3.5 text-sky" strokeWidth={1.75} />
          <span className="h-px flex-1 bg-[color-mix(in_oklab,var(--navy)_8%,transparent)]" />
        </div>

        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
          hint="At least 8 characters"
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

        {errorMessage && (
          <p className="fo-auth__alert anim-alert" role="alert">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
          {isLoading ? (
            <>
              <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthPanel>
  );
}

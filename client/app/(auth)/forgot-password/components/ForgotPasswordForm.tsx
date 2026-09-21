"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, MailCheck, ShieldAlert, Timer } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useForgotPasswordForm } from "../hooks/useForgotPasswordForm";
import "../forgot-password.css";

function BackToLogin() {
  return (
    <p>
      <Link href="/login" className="fo-auth__link fo-forgot__back">
        <ArrowLeft aria-hidden strokeWidth={2} />
        Back to log in
      </Link>
    </p>
  );
}

/** Colocated to `/forgot-password` — FlightOne desk recovery, not generic SaaS. */
export function ForgotPasswordForm() {
  const { email, setEmail, handleSubmit, isLoading, errorMessage, uiState } =
    useForgotPasswordForm();

  if (uiState === "success_queued") {
    return (
      <div className="fo-auth-form fo-forgot">
        <AuthPanel
          eyebrow="Account recovery"
          title="Check your email"
          footer={<BackToLogin />}
        >
          <div className="fo-forgot__stack">
            <div className="fo-forgot__glyph fo-forgot__glyph--ok" aria-hidden>
              <MailCheck strokeWidth={1.75} />
            </div>
            <p className="fo-auth__lead" role="status">
              If an account exists for that address, we sent a 6-digit reset code. It expires soon
              and works once.
            </p>
            <Link
              href={`/reset-password?email=${encodeURIComponent(email.trim())}`}
              className="fo-auth__submit inline-flex w-full items-center justify-center gap-1.5 text-white no-underline"
            >
              Enter reset code
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
        </AuthPanel>
      </div>
    );
  }

  if (uiState === "success_unconfigured") {
    return (
      <div className="fo-auth-form fo-forgot">
        <AuthPanel
          eyebrow="Account recovery"
          title="Reset prepared"
          footer={<BackToLogin />}
        >
          <div className="fo-forgot__stack">
            <div className="fo-forgot__glyph fo-forgot__glyph--warn" aria-hidden>
              <ShieldAlert strokeWidth={1.75} />
            </div>
            <p className="fo-auth__lead" role="status">
              If an account exists for that address, a reset was prepared. Email delivery is off in
              this environment — ask an admin to enable it, or use a reset link from a configured
              environment.
            </p>
          </div>
        </AuthPanel>
      </div>
    );
  }

  return (
    <div className="fo-auth-form fo-forgot">
      <AuthPanel
        eyebrow="Account recovery"
        title="Reset password"
        lead="Enter the email on your FlightOne account. We'll send a one-time 6-digit code."
        footer={<BackToLogin />}
      >
        <div className="fo-forgot__stack">
          <div className="fo-forgot__glyph" aria-hidden>
            <KeyRound strokeWidth={1.75} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="fo-auth__form"
            aria-busy={isLoading || undefined}
          >
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              hint="Same address you use to log in."
            />

            <p className="fo-forgot__hint">
              <Timer aria-hidden strokeWidth={2} />
              <span>Code expires shortly and can only be used once.</span>
            </p>

            {errorMessage ? (
              <p className="fo-auth__alert fo-auth-form__alert anim-alert" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
              {isLoading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Sending code…
                </>
              ) : (
                <>
                  Send verification code
                  <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                </>
              )}
            </Button>
          </form>
        </div>
      </AuthPanel>
    </div>
  );
}

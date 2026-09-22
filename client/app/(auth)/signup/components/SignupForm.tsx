"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Circle,
  Info,
  Mail,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useSignupForm } from "../hooks/useSignupForm";

const MIN_PASSWORD = 8;

function Progress({ step }: { step: "signup" | "verify" }) {
  const atVerify = step === "verify";
  return (
    <div className="fo-signup__progress" aria-label={`Signup progress: step ${atVerify ? 2 : 1} of 2`}>
      <span className={`fo-signup__progress-label ${atVerify ? "is-done" : "is-active"}`}>
        Account
      </span>
      <div
        className="fo-signup__progress-rail"
        data-step={step}
        aria-hidden
      >
        <span />
      </div>
      <span className={`fo-signup__progress-label ${atVerify ? "is-active" : ""}`}>Verify</span>
    </div>
  );
}

/** Colocated to `/signup` — FlightOne tokens, clear hierarchy, intact auth logic. */
export function SignupForm() {
  const {
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
  } = useSignupForm();

  const lengthOk = password.length >= MIN_PASSWORD;
  const matchOk = password.length > 0 && password === confirmPassword;

  if (step === "verify") {
    return (
      <div className="fo-auth-form fo-signup">
        <AuthPanel
          className="fo-signup__panel"
          title="Verify your email"
          lead={
            <>
              Enter the 6-digit code sent to{" "}
              <strong className="font-semibold text-navy">
                {email || "your email"}
              </strong>
              .
            </>
          }
          footer={
            <p className="fo-signup__footer-actions">
              Didn&apos;t get it?{" "}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading || isResending}
                className="fo-signup__footer-btn"
              >
                {isResending ? "Resending…" : "Resend code"}
              </button>
              <span className="fo-auth__sep" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => setStep("signup")}
                className="fo-signup__footer-btn"
              >
                Change email
              </button>
            </p>
          }
        >
          <Progress step="verify" />

          <form
            onSubmit={handleVerifySubmit}
            className="fo-auth__form"
            aria-busy={isLoading || undefined}
          >
            <div className="fo-signup__code-wrap">
              <Input
                label="Verification code"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                disabled={isLoading}
                autoFocus
                hint="6 digits from your inbox"
              />
            </div>

            {infoMessage ? (
              <p className="fo-signup__status" role="status">
                <Mail size={15} strokeWidth={2.25} aria-hidden />
                <span>{infoMessage}</span>
              </p>
            ) : null}

            {errorMessage ? (
              <p className="fo-auth__alert fo-signup__alert anim-alert" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="fo-auth__submit w-full"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Verifying…
                </>
              ) : (
                <>
                  Verify email
                  <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                </>
              )}
            </Button>
          </form>
        </AuthPanel>
      </div>
    );
  }

  return (
    <div className="fo-auth-form fo-signup">
      <AuthPanel
        className="fo-signup__panel"
        title="Create account"
        lead="Save trips and continue planning on any device."
        footer={
          <p>
            Already have an account?{" "}
            <Link href="/login" className="fo-auth__link">
              Log in
            </Link>
            <span className="fo-auth__sep" aria-hidden>
              ·
            </span>
            <Link href="/chat" className="fo-auth__link">
              Back to chat
            </Link>
          </p>
        }
      >
        <Progress step="signup" />

        <form
          onSubmit={handleSubmit}
          className="fo-auth__form"
          aria-busy={isLoading || undefined}
        >
          <div className="fo-signup__fields">
            <Input
              label="Name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={isLoading}
            />

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

            <div className="fo-signup__row fo-signup__row--passwords">
              <Input
                label="Password"
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
                placeholder="Repeat password"
                disabled={isLoading}
              />
            </div>

            <ul className="fo-signup__checks" aria-live="polite">
              <li className={`fo-signup__check ${lengthOk ? "is-met" : ""}`}>
                {lengthOk ? (
                  <Check size={12} strokeWidth={2.75} aria-hidden />
                ) : (
                  <Circle size={12} strokeWidth={2} aria-hidden />
                )}
                At least {MIN_PASSWORD} characters
              </li>
              <li className={`fo-signup__check ${matchOk ? "is-met" : ""}`}>
                {matchOk ? (
                  <Check size={12} strokeWidth={2.75} aria-hidden />
                ) : (
                  <Circle size={12} strokeWidth={2} aria-hidden />
                )}
                Passwords match
              </li>
            </ul>
          </div>

          {infoMessage ? (
            <p className="fo-signup__status" role="status">
              <Info size={15} strokeWidth={2.25} aria-hidden />
              <span>{infoMessage}</span>
            </p>
          ) : null}

          {errorMessage ? (
            <p className="fo-auth__alert fo-signup__alert anim-alert" role="alert">
              <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
              <span>{errorMessage}</span>
            </p>
          ) : null}

          <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
              </>
            )}
          </Button>
        </form>
      </AuthPanel>
    </div>
  );
}

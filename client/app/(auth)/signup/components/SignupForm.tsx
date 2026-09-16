"use client";

import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useSignupForm } from "../hooks/useSignupForm";

/** Colocated to `/signup` — matches login visual language. */
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

  if (step === "verify") {
    return (
      <AuthPanel
        title="Verify your email"
        lead={`Enter the 6-digit code sent to ${email || "your registered email"}.`}
        footer={
          <p>
            Didn't receive a code?{" "}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading || isResending}
              className="fo-auth__link underline cursor-pointer bg-transparent border-none p-0 inline font-inherit"
            >
              {isResending ? "Resending…" : "Resend code"}
            </button>
            <span className="fo-auth__sep" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => setStep("signup")}
              className="fo-auth__link underline cursor-pointer bg-transparent border-none p-0 inline font-inherit"
            >
              Change email
            </button>
          </p>
        }
      >
        <form onSubmit={handleVerifySubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
          <div className="space-y-3">
            <Input
              label="6-Digit Verification Code"
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {infoMessage && (
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium" role="status">
              {infoMessage}
            </p>
          )}

          {errorMessage && (
            <p className="fo-auth__alert anim-alert" role="alert">
              {errorMessage}
            </p>
          )}

          <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Verifying code…
              </>
            ) : (
              "Verify email"
            )}
          </Button>
        </form>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Create account"
      lead="Keep trips with Ava — pick up anytime."
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
      <form onSubmit={handleSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5">
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
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>

        {infoMessage && (
          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium" role="status">
            {infoMessage}
          </p>
        )}

        {errorMessage && (
          <p className="fo-auth__alert anim-alert" role="alert">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
          {isLoading ? (
            <>
              <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
              Creating account…
            </>
          ) : (
            "Sign up"
          )}
        </Button>
      </form>
    </AuthPanel>
  );
}

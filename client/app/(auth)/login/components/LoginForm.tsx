"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useLoginForm } from "../hooks/useLoginForm";

/** Colocated to `/login` only — email/password form wired to the RTK Query login mutation. */
export function LoginForm() {
  const { email, setEmail, password, setPassword, handleSubmit, isLoading, errorMessage, errorKind } =
    useLoginForm();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errorKind === "credentials") {
      passwordRef.current?.focus();
    }
  }, [errorKind]);

  return (
    <AuthPanel
      title="Log in"
      lead="Saved trips and Ava, ready when you are."
      footer={
        <p>
          New here?{" "}
          <Link href="/signup" className="fo-auth__link">
            Sign up
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
          ref={passwordRef}
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
        />

        <p className="fo-auth__forgot">
          <Link href="/forgot-password" className="fo-auth__link">
            Forgot password?
          </Link>
        </p>

        {errorMessage && (
          <div className="space-y-1">
            <p className="fo-auth__alert anim-alert" role="alert">
              {errorMessage}
            </p>
            {errorKind === "unverified" && (
              <p className="text-xs text-right">
                <Link
                  href={`/signup?email=${encodeURIComponent(email)}&step=verify`}
                  className="fo-auth__link text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Enter verification code →
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
          {isLoading ? (
            <>
              <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthPanel>
  );
}

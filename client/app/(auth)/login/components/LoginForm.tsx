"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  KeyRound,
} from "lucide-react";
import { Button, Input, QrCode, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useLoginForm } from "../hooks/useLoginForm";
import { normalizeBackupCode } from "@/lib/auth/twoFactorDisplay";

/** Multi-step login — same FlightOne auth-form surface as signup. */
export function LoginForm() {
  const {
    step,
    email,
    setEmail,
    password,
    setPassword,
    totpCode,
    setTotpCode,
    backupCode,
    setBackupCode,
    challengeMode,
    setChallengeMode,
    setupData,
    copiedSecret,
    copiedBackupCodes,
    isLoading,
    errorMessage,
    errorKind,
    handleCredentialsSubmit,
    handleSetupSubmit,
    handleBackupCodesDone,
    handleChallengeSubmit,
    handleCancelToCredentials,
    handleCopySecret,
    handleCopyBackupCodes,
  } = useLoginForm();

  const passwordRef = useRef<HTMLInputElement>(null);
  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errorKind === "credentials") {
      passwordRef.current?.focus();
    }
  }, [errorKind]);

  useEffect(() => {
    if (step === "2fa_challenge" || step === "2fa_setup") {
      totpInputRef.current?.focus();
    }
  }, [step, challengeMode]);

  if (step === "2fa_setup" && setupData) {
    const qrUri = setupData.otpauthUrl || setupData.otpauthUri || "";

    return (
      <div className="fo-auth-form fo-login">
        <AuthPanel
          title="Set up two-factor authentication"
          lead="Staff accounts require an authenticator app before accessing traveler and operational data."
          footer={
            <p>
              <button
                type="button"
                onClick={handleCancelToCredentials}
                className="fo-auth-form__footer-btn inline-flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                Back to sign in
              </button>
            </p>
          }
        >
          <form
            onSubmit={handleSetupSubmit}
            className="fo-auth__form"
            aria-busy={isLoading || undefined}
          >
            <div className="fo-auth-form__tile">
              <div className="fo-auth-form__qr-box">
                <QrCode value={qrUri} size={160} alt="Staff 2FA enrollment QR code" />
                <p className="mt-3 max-w-[16rem] text-[0.75rem] leading-snug text-ink-soft">
                  Scan with Google Authenticator, 1Password, or Authy
                </p>
              </div>

              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                  <KeyRound className="size-3.5 shrink-0 text-cyan" aria-hidden />
                  Or enter this setup key
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="fo-auth-form__code-value">{setupData.secret}</code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySecret}
                    aria-label={copiedSecret ? "Setup key copied" : "Copy setup key"}
                    className="!rounded-full shrink-0 gap-1.5 px-2.5 text-xs"
                    icon={
                      copiedSecret ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )
                    }
                  >
                    {copiedSecret ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="fo-auth-form__code">
              <Input
                id="staff-totp-code"
                ref={totpInputRef}
                label="6-digit verification code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                disabled={isLoading}
                autoComplete="one-time-code"
              />
            </div>

            {errorMessage ? (
              <p className="fo-auth__alert fo-auth-form__alert anim-alert" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={totpCode.length < 6 || isLoading}
              className="fo-auth__submit w-full"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Enabling…
                </>
              ) : (
                <>
                  Enable two-factor authentication
                  <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                </>
              )}
            </Button>
          </form>
        </AuthPanel>
      </div>
    );
  }

  if (step === "backup_codes_view" && setupData) {
    return (
      <div className="fo-auth-form fo-login">
        <AuthPanel
          title="Save your recovery codes"
          lead="Store these single-use codes somewhere safe. They are the only fallback if you lose your authenticator."
        >
          <div className="fo-auth-form__fields">
            <div className="fo-auth-form__notice" role="status">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[var(--danger)]"
                aria-hidden
              />
              <p>
                <strong>Shown once.</strong> If your device is lost, these ten codes are the only
                way back into your staff account.
              </p>
            </div>

            <div className="fo-auth-form__tile">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs font-semibold text-navy">
                {setupData.backupCodes.map((code) => (
                  <div key={code} className="fo-auth-form__backup-code">
                    {code}
                  </div>
                ))}
              </div>

              <div className="fo-auth-form__backup-footer">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyBackupCodes}
                  aria-label={
                    copiedBackupCodes ? "Recovery codes copied" : "Copy all recovery codes"
                  }
                  className="!rounded-full gap-1.5 text-xs"
                  icon={
                    copiedBackupCodes ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      <ClipboardList className="size-3.5" aria-hidden />
                    )
                  }
                >
                  {copiedBackupCodes ? "Copied" : "Copy all"}
                </Button>
                <span className="text-[0.7rem] text-ink-faint">10 single-use codes</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleBackupCodesDone}
              className="fo-auth__submit w-full"
            >
              I&apos;ve saved my codes — continue
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </Button>
          </div>
        </AuthPanel>
      </div>
    );
  }

  if (step === "2fa_challenge") {
    return (
      <div className="fo-auth-form fo-login">
        <AuthPanel
          title="Verify it's you"
          lead={
            challengeMode === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : "Enter one unused 8-character recovery code."
          }
          footer={
            <p>
              <button
                type="button"
                onClick={handleCancelToCredentials}
                className="fo-auth-form__footer-btn inline-flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                Back to sign in
              </button>
            </p>
          }
        >
          <form
            onSubmit={handleChallengeSubmit}
            className="fo-auth__form"
            aria-busy={isLoading || undefined}
          >
            {challengeMode === "totp" ? (
              <div className="fo-auth-form__code">
                <Input
                  id="challenge-totp-code"
                  ref={totpInputRef}
                  label="Authenticator code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  hint="6 digits from your authenticator app"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="challenge-backup-code"
                  className="flex items-center gap-1.5 text-xs font-semibold text-navy"
                >
                  <KeyRound className="size-3.5 shrink-0 text-cyan" aria-hidden />
                  Recovery code
                </label>
                <Input
                  id="challenge-backup-code"
                  ref={totpInputRef}
                  type="text"
                  maxLength={9}
                  required
                  autoFocus
                  value={backupCode}
                  onChange={(e) => setBackupCode(normalizeBackupCode(e.target.value))}
                  placeholder="XXXX-XXXX"
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  className="mt-1.5 text-center font-mono text-lg font-semibold uppercase tracking-[0.2em]"
                />
              </div>
            )}

            <div className="text-right">
              {challengeMode === "totp" ? (
                <button
                  type="button"
                  onClick={() => {
                    setChallengeMode("backup_code");
                    setTotpCode("");
                  }}
                  className="fo-auth__link text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 focus-visible:ring-offset-2"
                >
                  Use a recovery code instead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setChallengeMode("totp");
                    setBackupCode("");
                  }}
                  className="fo-auth__link text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 focus-visible:ring-offset-2"
                >
                  Use authenticator app instead
                </button>
              )}
            </div>

            {errorMessage ? (
              <p className="fo-auth__alert fo-auth-form__alert anim-alert" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={
                (challengeMode === "totp"
                  ? totpCode.length < 6
                  : backupCode.replace(/[^A-Za-z0-9]/g, "").length < 8) || isLoading
              }
              className="fo-auth__submit w-full"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                  Verifying…
                </>
              ) : (
                <>
                  Verify and sign in
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
    <div className="fo-auth-form fo-login">
      <AuthPanel
        title="Log in"
        lead="Sign in to continue to your trips and bookings."
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
        <form
          onSubmit={handleCredentialsSubmit}
          className="fo-auth__form"
          aria-busy={isLoading || undefined}
        >
          <div className="fo-auth-form__fields">
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
          </div>

          <p className="fo-auth__forgot">
            <Link href="/forgot-password" className="fo-auth__link">
              Forgot password?
            </Link>
          </p>

          {errorMessage ? (
            <div className="space-y-1.5">
              <p className="fo-auth__alert fo-auth-form__alert anim-alert" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden />
                <span>{errorMessage}</span>
              </p>
              {errorKind === "unverified" ? (
                <p className="text-right text-xs">
                  <Link
                    href={`/signup?email=${encodeURIComponent(email)}&step=verify`}
                    className="fo-auth__link"
                  >
                    Enter verification code
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={isLoading} className="fo-auth__submit w-full">
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Signing in…
              </>
            ) : (
              <>
                Log in
                <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
              </>
            )}
          </Button>
        </form>
      </AuthPanel>
    </div>
  );
}

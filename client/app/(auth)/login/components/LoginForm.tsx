"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Input, QrCode, Spinner } from "@/components/ui";
import { AuthPanel } from "../../components/AuthPanel";
import { useLoginForm } from "../hooks/useLoginForm";
import { normalizeBackupCode } from "@/lib/auth/twoFactorDisplay";

/** Multi-step login component: standard credentials, staff mandatory 2FA enrollment, and 2FA challenge. */
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

  // STEP 2: STAFF MANDATORY 2FA ENROLLMENT
  if (step === "2fa_setup" && setupData) {
    const qrUri = setupData.otpauthUrl || setupData.otpauthUri || "";

    return (
      <AuthPanel
        title="Mandatory Staff MFA"
        lead="As a staff member with access to operational and traveler records, two-factor authentication is required."
        footer={
          <p>
            <button
              type="button"
              onClick={handleCancelToCredentials}
              className="fo-auth__link text-xs text-slate-500 hover:text-slate-700"
            >
              ← Cancel and return to sign in
            </button>
          </p>
        }
      >
        <form onSubmit={handleSetupSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
          <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/30 p-4 space-y-4">
            <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-200 text-center">
              <QrCode value={qrUri} size={160} alt="Staff 2FA Enrollment QR Code" />
              <p className="mt-2 text-[11px] text-slate-500 font-medium">
                Scan with Google Authenticator, 1Password, or Authy
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">
                Or enter this setup key manually:
              </span>
              <div className="mt-1 flex items-center gap-2">
                <code className="block flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-800 select-all">
                  {setupData.secret}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopySecret}
                  className="shrink-0 text-xs px-2.5 py-1"
                >
                  {copiedSecret ? "✓ Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="staff-totp-code" className="block text-xs font-semibold text-slate-700">
              Enter 6-Digit Verification Code
            </label>
            <Input
              id="staff-totp-code"
              ref={totpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              disabled={isLoading}
              className="mt-1 font-mono text-center text-xl tracking-widest font-bold"
            />
          </div>

          {errorMessage && (
            <p className="fo-auth__alert anim-alert" role="alert">
              {errorMessage}
            </p>
          )}

          <Button
            type="submit"
            disabled={totpCode.length < 6 || isLoading}
            className="fo-auth__submit w-full"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                Activating 2FA…
              </>
            ) : (
              "Confirm & Enable 2FA"
            )}
          </Button>
        </form>
      </AuthPanel>
    );
  }

  // STEP 3: BACKUP CODES VIEW AFTER STAFF ENROLLMENT
  if (step === "backup_codes_view" && setupData) {
    return (
      <AuthPanel
        title="Emergency Recovery Codes"
        lead="Your authenticator is connected! Store these single-use recovery codes in a safe place."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-3.5 text-xs text-amber-900">
            <strong className="block font-semibold mb-0.5">Critical Security Notice:</strong>
            If your mobile device is lost or inaccessible, these 10 recovery codes are the ONLY way
            to log in. They will <strong>never be shown again</strong>.
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs font-semibold text-slate-800 text-center">
              {setupData.backupCodes.map((c, i) => (
                <div key={i} className="rounded bg-slate-50 border border-slate-100 py-1 select-all">
                  {c}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyBackupCodes}
                className="text-xs"
              >
                {copiedBackupCodes ? "✓ Copied 10 Codes" : "📋 Copy All Codes"}
              </Button>
              <span className="text-[11px] text-slate-400">10 single-use codes</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleBackupCodesDone}
            className="fo-auth__submit w-full bg-slate-900 hover:bg-slate-800"
          >
            I have saved my codes — Continue to Dashboard →
          </Button>
        </div>
      </AuthPanel>
    );
  }

  // STEP 4: 2FA CHALLENGE (DURING LOGIN)
  if (step === "2fa_challenge") {
    return (
      <AuthPanel
        title="Two-Factor Authentication"
        lead={
          challengeMode === "totp"
            ? "Enter the 6-digit security code generated by your authenticator app."
            : "Enter an unused 8-character emergency backup recovery code."
        }
        footer={
          <p>
            <button
              type="button"
              onClick={handleCancelToCredentials}
              className="fo-auth__link text-xs text-slate-500 hover:text-slate-700"
            >
              ← Cancel and return to sign in
            </button>
          </p>
        }
      >
        <form onSubmit={handleChallengeSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
          {challengeMode === "totp" ? (
            <div>
              <label htmlFor="challenge-totp-code" className="block text-xs font-semibold text-slate-700">
                Security Code
              </label>
              <Input
                id="challenge-totp-code"
                ref={totpInputRef}
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
                className="mt-1 font-mono text-center text-2xl tracking-widest font-bold"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="challenge-backup-code" className="block text-xs font-semibold text-slate-700">
                Emergency Backup Recovery Code
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
                className="mt-1 font-mono text-center text-lg tracking-widest font-bold uppercase"
              />
            </div>
          )}

          {/* Toggle between TOTP and Backup code */}
          <div className="text-right">
            {challengeMode === "totp" ? (
              <button
                type="button"
                onClick={() => {
                  setChallengeMode("backup_code");
                  setTotpCode("");
                }}
                className="text-xs text-cyan-600 hover:underline hover:text-cyan-700"
              >
                Use an emergency recovery code instead →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setChallengeMode("totp");
                  setBackupCode("");
                }}
                className="text-xs text-cyan-600 hover:underline hover:text-cyan-700"
              >
                Use mobile authenticator app instead →
              </button>
            )}
          </div>

          {errorMessage && (
            <p className="fo-auth__alert anim-alert" role="alert">
              {errorMessage}
            </p>
          )}

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
              "Verify & Sign In"
            )}
          </Button>
        </form>
      </AuthPanel>
    );
  }

  // STEP 1: STANDARD CREDENTIALS FORM (DEFAULT)
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
      <form onSubmit={handleCredentialsSubmit} className="fo-auth__form" aria-busy={isLoading || undefined}>
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

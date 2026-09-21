"use client";

import { useState } from "react";
import { KeyRound, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Input, QrCode, Spinner } from "@/components/ui";
import { TravellerSection, TravellerChip } from "@/app/components/traveller";
import { useAuthStore } from "@/store/auth.store";
import {
  useTwoFactorSetupMutation,
  useTwoFactorConfirmMutation,
  useTwoFactorDisableMutation,
  type TwoFactorSetupResponse,
} from "@/lib/api/auth.api";

type FlowMode = "idle" | "enrolling" | "backup_codes" | "disabling";

export function TwoFactorSection() {
  const user = useAuthStore((s) => s.user);
  const isEnabled = Boolean(user?.twoFactorEnabled);

  const [mode, setMode] = useState<FlowMode>("idle");
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [setup2fa, { isLoading: isStartingSetup }] = useTwoFactorSetupMutation();
  const [confirm2fa, { isLoading: isConfirming }] = useTwoFactorConfirmMutation();
  const [disable2fa, { isLoading: isDisabling }] = useTwoFactorDisableMutation();

  async function handleStartSetup() {
    setErrorMessage(null);
    setStatusMessage(null);
    setConfirmCode("");
    try {
      const data = await setup2fa().unwrap();
      setSetupData(data);
      setMode("enrolling");
    } catch (err: unknown) {
      setErrorMessage(extractError(err, "Could not start 2FA setup. Try again."));
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmCode.trim()) return;
    setErrorMessage(null);
    try {
      await confirm2fa({ code: confirmCode.trim() }).unwrap();
      setStatusMessage("Two-factor authentication is on.");
      setMode("backup_codes");
    } catch (err: unknown) {
      setErrorMessage(extractError(err, "Invalid code. Check your authenticator and try again."));
    }
  }

  function handleDismissBackupCodes() {
    setSetupData(null);
    setConfirmCode("");
    setMode("idle");
  }

  async function handleDisable2fa(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await disable2fa({
        password: disablePassword.trim() || undefined,
        code: disableCode.trim() || undefined,
      }).unwrap();
      setStatusMessage("Two-factor authentication is off.");
      setDisablePassword("");
      setDisableCode("");
      setMode("idle");
    } catch (err: unknown) {
      setErrorMessage(
        extractError(err, "Could not disable 2FA. Verify password or authenticator code."),
      );
    }
  }

  function handleCopySecret() {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  function handleCopyBackupCodes() {
    if (!setupData?.backupCodes?.length) return;
    navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  }

  const qrUri = setupData?.otpauthUrl || setupData?.otpauthUri || "";

  return (
    <TravellerSection
      title="Two-factor authentication"
      note="Require a 6-digit authenticator code in addition to your password."
    >
      <div className="fo-profile__2fa-status">
        <div className="fo-profile__2fa-status-main">
          <span
            className={`fo-profile__2fa-icon${isEnabled ? " fo-profile__2fa-icon--on" : ""}`}
            aria-hidden
          >
            {isEnabled ? (
              <ShieldCheck size={18} strokeWidth={1.75} />
            ) : (
              <Shield size={18} strokeWidth={1.75} />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="fo-profile__2fa-title">
                {isEnabled ? "2FA is on" : "2FA is off"}
              </p>
              <TravellerChip tone={isEnabled ? "default" : "muted"}>
                {isEnabled ? "Protected" : "Optional"}
              </TravellerChip>
            </div>
            <p className="fo-profile__2fa-note">
              {isEnabled
                ? "Sign-in requires an authenticator code or a backup recovery code."
                : "Turn on to protect bookings and personal details."}
            </p>
          </div>
        </div>

        {mode === "idle" ? (
          <div className="shrink-0">
            {isEnabled ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setErrorMessage(null);
                  setStatusMessage(null);
                  setMode("disabling");
                }}
              >
                Disable 2FA
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleStartSetup} disabled={isStartingSetup}>
                {isStartingSetup ? (
                  <>
                    <Spinner size="sm" label={null} />
                    Starting…
                  </>
                ) : (
                  "Enable 2FA"
                )}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {statusMessage && mode === "idle" ? (
        <p className="text-[13px] font-medium text-[var(--sky)]" role="status">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage && mode === "idle" ? (
        <p className="text-[13px] font-medium text-[var(--danger)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {mode === "enrolling" && setupData ? (
        <div className="fo-profile__2fa-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="fo-profile__form-label">Connect authenticator</p>
              <p className="fo-profile__2fa-note mt-1">
                Google Authenticator, 1Password, Microsoft Authenticator, or Bitwarden.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSetupData(null);
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2 rounded-[0.5rem] border border-[var(--line)] bg-white p-3">
              <QrCode value={qrUri} size={160} alt="FlightOne 2FA QR code" />
              <span className="text-[11px] text-[var(--ink-faint)]">Scan with your app</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Or enter this secret manually
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="block flex-1 select-all rounded-[0.45rem] border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs font-semibold tracking-wider text-[var(--navy)] sm:text-sm">
                    {setupData.secret}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    {copiedSecret ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleConfirmSetup} className="space-y-3">
                <Input
                  id="totp-confirm-input"
                  label="6-digit code from your app"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="000000"
                  value={confirmCode}
                  onChange={(e) =>
                    setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="font-mono text-center text-lg tracking-widest font-semibold"
                  disabled={isConfirming}
                />

                {errorMessage ? (
                  <p className="text-[13px] font-medium text-[var(--danger)]" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={confirmCode.length < 6 || isConfirming}
                  >
                    {isConfirming ? (
                      <>
                        <Spinner size="sm" label={null} />
                        Confirming…
                      </>
                    ) : (
                      "Confirm & enable"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSetupData(null);
                      setMode("idle");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "backup_codes" && setupData ? (
        <div className="fo-profile__2fa-panel fo-profile__2fa-panel--backup">
          <div className="flex items-start gap-3">
            <span className="fo-profile__2fa-icon" aria-hidden>
              <KeyRound size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="fo-profile__2fa-title">Save your backup codes</p>
              <p className="fo-profile__2fa-note">
                Single-use recovery codes if you lose your authenticator. Store them offline.
                They will not be shown again after you leave this page.
              </p>
            </div>
          </div>

          <div className="fo-profile__codes">
            {setupData.backupCodes.map((code) => (
              <div key={code} className="fo-profile__code">
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyBackupCodes}>
              {copiedCodes ? "Copied" : "Copy all codes"}
            </Button>
            <span className="text-[11px] text-[var(--ink-faint)]">
              10 codes · single use each
            </span>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleDismissBackupCodes}>
              I have saved my codes
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "disabling" ? (
        <div className="fo-profile__2fa-panel fo-profile__2fa-panel--warn">
          <div className="flex items-start gap-3">
            <span className="fo-profile__2fa-icon" aria-hidden>
              <ShieldOff size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="fo-profile__2fa-title">Disable two-factor authentication</p>
              <p className="fo-profile__2fa-note">
                Confirm with your account password or a current authenticator code.
              </p>
            </div>
          </div>

          <form onSubmit={handleDisable2fa} className="max-w-md space-y-3">
            <Input
              label="Account password"
              type="password"
              placeholder="••••••••"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              disabled={isDisabling}
            />
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
              or
            </p>
            <Input
              label="Authenticator code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={isDisabling}
              className="font-mono tracking-widest"
            />

            {errorMessage ? (
              <p className="text-[13px] font-medium text-[var(--danger)]" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={(!disablePassword.trim() && disableCode.length < 6) || isDisabling}
              >
                {isDisabling ? (
                  <>
                    <Spinner size="sm" label={null} />
                    Disabling…
                  </>
                ) : (
                  "Confirm disable"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDisablePassword("");
                  setDisableCode("");
                  setErrorMessage(null);
                  setMode("idle");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </TravellerSection>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string; message?: string } }).data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

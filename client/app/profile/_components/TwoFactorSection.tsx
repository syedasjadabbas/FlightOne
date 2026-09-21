"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Input, QrCode, Spinner } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";
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
      setStatusMessage("Two-factor authentication is now active on your account.");
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
      setStatusMessage("Two-factor authentication has been disabled.");
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
      title="Two-Factor Authentication"
      note="Require a hardware-backed TOTP code in addition to your password for elevated security."
      panel
    >
      {/* 2FA Status Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white/90 p-4.5 shadow-sm transition-all hover:border-black/15">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isEnabled ? "bg-emerald/15 text-emerald" : "bg-black/6 text-ink-faint"
            }`}
          >
            {isEnabled ? (
              <ShieldCheck size={20} strokeWidth={2.2} />
            ) : (
              <Shield size={20} strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-navy">
                {isEnabled ? "Two-Factor Auth Active" : "Two-Factor Auth Inactive"}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                  isEnabled ? "bg-emerald/15 text-emerald" : "bg-black/6 text-ink-faint"
                }`}
              >
                {isEnabled ? "Protected" : "Optional"}
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              {isEnabled
                ? "Sign-ins require an authenticator app code or saved backup recovery code."
                : "Enable 2FA to protect personal identity documents and booking access."}
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
              <Button
                type="button"
                size="md"
                onClick={handleStartSetup}
                disabled={isStartingSetup}
              >
                {isStartingSetup ? (
                  <>
                    <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
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
        <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-sky" role="status">
          <Check size={14} strokeWidth={2.5} />
          <span>{statusMessage}</span>
        </p>
      ) : null}

      {errorMessage && mode === "idle" ? (
        <p className="mt-3 text-[13px] font-medium text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {/* Enrolling Step */}
      {mode === "enrolling" && setupData ? (
        <div className="mt-4 rounded-2xl border border-black/8 bg-white/75 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold tracking-wider text-ink-faint uppercase">
                Connect Authenticator App
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">
                Scan with Google Authenticator, 1Password, Apple Passwords, or Bitwarden.
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

          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <QrCode value={qrUri} size={150} alt="FlightOne 2FA QR code" />
              <span className="text-[11px] font-medium text-ink-faint">Scan QR in Authenticator</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                  Or enter manual setup key
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="block flex-1 select-all rounded-xl border border-black/10 bg-white px-3.5 py-2 font-mono text-[13px] font-bold tracking-wider text-navy">
                    {setupData.secret}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    {copiedSecret ? (
                      <>
                        <Check size={12} strokeWidth={2.5} className="text-emerald" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} strokeWidth={2} />
                        <span>Copy Key</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleConfirmSetup} className="space-y-3">
                <Input
                  id="totp-confirm-input"
                  label="6-Digit Verification Code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="000 000"
                  value={confirmCode}
                  onChange={(e) =>
                    setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="font-mono text-center text-lg tracking-widest font-bold"
                  disabled={isConfirming}
                />

                {errorMessage ? (
                  <p className="text-[13px] font-medium text-danger" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="submit"
                    size="md"
                    disabled={confirmCode.length < 6 || isConfirming}
                  >
                    {isConfirming ? (
                      <>
                        <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                        Confirming…
                      </>
                    ) : (
                      "Confirm & Activate 2FA"
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

      {/* Backup Codes Display */}
      {mode === "backup_codes" && setupData ? (
        <div className="mt-4 rounded-2xl border border-emerald/20 bg-emerald/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald/15 text-emerald">
              <KeyRound size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-navy">Save Emergency Backup Codes</p>
              <p className="text-[12.5px] text-ink-soft">
                Single-use offline recovery codes. Store them securely. They will not be shown again.
              </p>
            </div>
          </div>

          <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {setupData.backupCodes.map((code) => (
              <div
                key={code}
                className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-center font-mono text-[12.5px] font-semibold text-navy shadow-xs"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyBackupCodes}>
              {copiedCodes ? (
                <>
                  <Check size={12} strokeWidth={2.5} className="text-emerald" />
                  <span>All Codes Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} strokeWidth={2} />
                  <span>Copy All Codes</span>
                </>
              )}
            </Button>

            <Button type="button" size="md" onClick={handleDismissBackupCodes}>
              I Have Saved My Codes
            </Button>
          </div>
        </div>
      ) : null}

      {/* Disable 2FA Panel */}
      {mode === "disabling" ? (
        <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
              <ShieldOff size={18} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-navy">Disable Two-Factor Authentication</p>
              <p className="text-[12.5px] text-ink-soft">
                Confirm with your current password or an active authenticator code.
              </p>
            </div>
          </div>

          <form onSubmit={handleDisable2fa} className="mt-4 max-w-md space-y-3">
            <Input
              label="Account Password"
              type="password"
              placeholder="••••••••"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              disabled={isDisabling}
            />
            <p className="text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              or
            </p>
            <Input
              label="Current Authenticator Code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000 000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={isDisabling}
              className="font-mono tracking-widest text-center font-bold"
            />

            {errorMessage ? (
              <p className="text-[13px] font-medium text-danger" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="submit"
                variant="danger"
                size="md"
                disabled={(!disablePassword.trim() && disableCode.length < 6) || isDisabling}
              >
                {isDisabling ? (
                  <>
                    <Spinner size="sm" className="border-white/30 border-t-white" label={null} />
                    Disabling…
                  </>
                ) : (
                  "Confirm Disable 2FA"
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

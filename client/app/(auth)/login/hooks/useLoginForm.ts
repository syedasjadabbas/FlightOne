"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useLoginMutation,
  useTwoFactorSetupMutation,
  useTwoFactorConfirmMutation,
  useTwoFactorVerifyMutation,
  type TwoFactorSetupResponse,
} from "@/lib/api/auth.api";
import {
  isStaffRole,
  normalizeTotpCode,
  normalizeBackupCode,
  resolvePostLoginRedirect,
  formatTwoFactorError,
} from "@/lib/auth/twoFactorDisplay";
import { formatApiError } from "@/lib/api/formatApiError";
import { useAuthStore, type AuthSession } from "@/store/auth.store";

export type LoginStep =
  | "credentials"
  | "2fa_challenge"
  | "2fa_setup"
  | "backup_codes_view";

export type ChallengeMode = "totp" | "backup_code";

/** Seed defaults from server `DEMO_USER_*` — local login convenience only. */
const LOCAL_DEMO_EMAIL =
  process.env.NODE_ENV === "development" ? "demo@flightone.local" : "";
const LOCAL_DEMO_PASSWORD =
  process.env.NODE_ENV === "development" ? "DemoPass123!" : "";

/** Colocated to `/login` only — multi-step auth handling standard & mandatory staff 2FA. */
export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Multi-step state
  const [step, setStep] = useState<LoginStep>("credentials");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>("totp");
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);

  // Form input states
  const [email, setEmail] = useState(LOCAL_DEMO_EMAIL);
  const [password, setPassword] = useState(LOCAL_DEMO_PASSWORD);
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");

  // UI notifications
  const [customError, setCustomError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Mutations
  const [login, { isLoading: isLoggingIn, error: loginError }] = useLoginMutation();
  const [setup2fa, { isLoading: isSettingUp }] = useTwoFactorSetupMutation();
  const [confirm2fa, { isLoading: isConfirming }] = useTwoFactorConfirmMutation();
  const [verify2fa, { isLoading: isVerifying }] = useTwoFactorVerifyMutation();

  const redirectUrl = searchParams.get("redirect");

  // Step 1: Handle Email & Password
  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCustomError(null);

    try {
      const res = await login({ email, password }).unwrap();

      if ("requires2fa" in res && res.requires2fa) {
        setTempToken(res.tempToken);

        if ("requires2faSetup" in res && res.requires2faSetup) {
          // Staff mandatory enrollment flow
          try {
            const setup = await setup2fa({ tempToken: res.tempToken }).unwrap();
            setSetupData(setup);
            setStep("2fa_setup");
          } catch (setupErr: any) {
            setCustomError(
              formatTwoFactorError(setupErr) ||
                "Failed to initiate staff 2FA enrollment. Please try again."
            );
          }
        } else {
          // Standard or staff 2FA challenge flow
          setChallengeMode("totp");
          setStep("2fa_challenge");
        }
      } else {
        // Successful login without 2FA challenge
        if ("accessToken" in res && res.accessToken) {
          useAuthStore.getState().setSession(res as AuthSession);
        }
        const target = resolvePostLoginRedirect(
          "user" in res ? res.user?.role : null,
          redirectUrl
        );
        if (typeof window !== "undefined") {
          window.location.assign(target);
        } else {
          router.replace(target);
        }
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 403) {
        setCustomError(
          formatApiError(
            err,
            "Please verify your email before signing in. Check your inbox for a code.",
          ),
        );
      } else {
        setCustomError(formatApiError(err, "Incorrect email or password."));
      }
    }
  }

  // Step 2: Handle Staff Mandatory 2FA Setup Confirmation
  async function handleSetupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tempToken || !totpCode.trim()) return;
    setCustomError(null);

    try {
      const confirmRes = await confirm2fa({
        code: normalizeTotpCode(totpCode),
        tempToken,
      }).unwrap();

      if (confirmRes && "accessToken" in confirmRes && confirmRes.accessToken) {
        useAuthStore.getState().setSession(confirmRes as AuthSession);
      }

      // Show backup recovery codes on success
      setStep("backup_codes_view");
    } catch (err: any) {
      setCustomError(formatTwoFactorError(err));
    }
  }

  // Step 3: Dismiss Backup Codes and Enter App
  function handleBackupCodesDone() {
    setSetupData(null);
    setTempToken(null);
    setTotpCode("");
    const target = resolvePostLoginRedirect("Staff", redirectUrl);
    if (typeof window !== "undefined") {
      window.location.assign(target);
    } else {
      router.replace(target);
    }
  }

  // Step 4: Handle 2FA Challenge (TOTP or Backup Code)
  async function handleChallengeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tempToken) return;
    setCustomError(null);

    const codeToVerify =
      challengeMode === "totp"
        ? normalizeTotpCode(totpCode)
        : normalizeBackupCode(backupCode).replace("-", "");

    if (!codeToVerify) return;

    try {
      const res = await verify2fa({
        code: codeToVerify,
        tempToken,
        type: challengeMode,
      }).unwrap();

      if ("accessToken" in res && res.accessToken) {
        useAuthStore.getState().setSession(res as AuthSession);
      }
      const target = resolvePostLoginRedirect(res.user?.role, redirectUrl);
      if (typeof window !== "undefined") {
        window.location.assign(target);
      } else {
        router.replace(target);
      }
    } catch (err: any) {
      setCustomError(formatTwoFactorError(err));
    }
  }

  function handleCancelToCredentials() {
    setStep("credentials");
    setTempToken(null);
    setSetupData(null);
    setTotpCode("");
    setBackupCode("");
    setCustomError(null);
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
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2500);
  }

  // Error Kind & Message Resolution
  const errorKind: "credentials" | "unverified" | "unknown" | null = !loginError
    ? null
    : "status" in loginError && loginError.status === 401
      ? "credentials"
      : "status" in loginError && loginError.status === 403
        ? "unverified"
        : "unknown";

  const errorMessage =
    customError ||
    (errorKind === "credentials"
      ? "Incorrect email or password."
      : errorKind === "unverified"
        ? "Email address not verified. Please verify your email to log in."
        : errorKind === "unknown"
          ? "Something went wrong — please try again."
          : null);

  const isLoading = isLoggingIn || isSettingUp || isConfirming || isVerifying;

  return {
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
  };
}

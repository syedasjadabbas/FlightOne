"use client";

import { useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  useListSessionsQuery,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from "@/lib/api/auth.api";
import {
  formatSessionWhen,
  sessionsUiState,
} from "@/lib/auth/sessionsDisplay";

export function SessionsSection() {
  const { data, isLoading, isError, refetch } = useListSessionsQuery();
  const [revokeSession, { isLoading: revoking }] = useRevokeSessionMutation();
  const [revokeOthers, { isLoading: revokingOthers }] =
    useRevokeOtherSessionsMutation();
  const [justRevoked, setJustRevoked] = useState(false);
  const [justRevokedOthers, setJustRevokedOthers] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const sessions = data?.sessions ?? [];
  const uiState = sessionsUiState({
    isLoading,
    isError,
    sessionCount: sessions.length,
    justRevoked,
    justRevokedOthers,
  });

  async function onRevoke(id: string, isCurrent: boolean) {
    setActionError(null);
    setJustRevoked(false);
    setJustRevokedOthers(false);
    try {
      await revokeSession(id).unwrap();
      setJustRevoked(true);
      if (isCurrent) {
        // Store cleared by mutation; hard navigate to login.
        window.location.assign("/login");
      }
    } catch {
      setActionError("Could not sign out that session. Try again.");
    }
  }

  async function onRevokeOthers() {
    setActionError(null);
    setJustRevoked(false);
    setJustRevokedOthers(false);
    try {
      await revokeOthers().unwrap();
      setJustRevokedOthers(true);
    } catch {
      setActionError("Could not sign out other sessions. Try again.");
    }
  }

  return (
    <TravellerSection
      title="Devices & sessions"
      note="Active sign-ins on this account. Sign out a device you do not recognize, or end every other session and keep this one."
    >
      {uiState === "loading" ? <Spinner label="Loading sessions" /> : null}

      {uiState === "error" ? (
        <TravellerState
          variant="error"
          title="Sessions unavailable"
          action={
            <Button type="button" variant="ghost" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load active devices.
        </TravellerState>
      ) : null}

      {uiState === "empty" ? (
        <TravellerState title="No active sessions">Sign in again to create a session.</TravellerState>
      ) : null}

      {(uiState === "ready" ||
        uiState === "success_revoke" ||
        uiState === "success_revoke_others") && (
        <>
          {(justRevoked || justRevokedOthers) && (
            <p className="text-[13px] text-[var(--sky)]" role="status">
              {justRevokedOthers
                ? "Other sessions signed out."
                : "Session signed out."}
            </p>
          )}
          {actionError ? (
            <p className="text-[13px] text-[var(--danger)]" role="alert">
              {actionError}
            </p>
          ) : null}
          <ul className="fo-traveller__list">
            {sessions.map((s) => (
              <li key={s.id} className="fo-traveller__row">
                <div className="fo-traveller__row-top">
                  <div className="min-w-0">
                    <p className="fo-traveller__row-title">
                      {s.deviceLabel}
                      {s.current ? (
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--sky)]">
                          This device
                        </span>
                      ) : null}
                    </p>
                    <p className="fo-traveller__row-meta">
                      Last used {formatSessionWhen(s.lastUsedAt)}
                      {s.ip ? ` · ${s.ip}` : ""}
                    </p>
                    <p className="fo-traveller__row-meta">
                      Signed in {formatSessionWhen(s.createdAt)} · Expires{" "}
                      {formatSessionWhen(s.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revoking || revokingOthers}
                    onClick={() => onRevoke(s.id, s.current)}
                  >
                    {s.current ? "Sign out" : "Revoke"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {sessions.some((s) => !s.current) ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={revoking || revokingOthers}
                onClick={onRevokeOthers}
              >
                {revokingOthers ? "Signing out…" : "Sign out all other sessions"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </TravellerSection>
  );
}

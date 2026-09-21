"use client";

import { useState } from "react";
import { Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
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
      title="Active Devices & Sessions"
      note="Manage active sign-ins across all browsers and devices. Terminate sessions remotely if unrecognized."
      panel
    >
      {uiState === "loading" ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading active sessions…" />
        </div>
      ) : null}

      {uiState === "error" ? (
        <TravellerState
          variant="error"
          title="Sessions Unavailable"
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
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
          <p className="text-[14px] font-semibold text-navy">No Active Sessions</p>
          <p className="text-[12.5px] text-ink-soft">Sign in again to create a session.</p>
        </div>
      ) : null}

      {(uiState === "ready" ||
        uiState === "success_revoke" ||
        uiState === "success_revoke_others") && (
        <>
          {(justRevoked || justRevokedOthers) && (
            <p className="mb-3 text-[13px] font-medium text-sky" role="status">
              {justRevokedOthers
                ? "All other sessions were signed out."
                : "Session signed out successfully."}
            </p>
          )}
          {actionError ? (
            <p className="mb-3 text-[13px] font-medium text-danger" role="alert">
              {actionError}
            </p>
          ) : null}

          <div className="space-y-3">
            {sessions.map((s) => {
              const isMobile = /mobile|phone|ios|android/i.test(s.deviceLabel || "");
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/90 p-4 shadow-sm transition-all hover:border-black/15"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        s.current ? "bg-emerald/15 text-emerald" : "bg-navy/10 text-navy"
                      }`}
                    >
                      {isMobile ? (
                        <Smartphone size={20} strokeWidth={2} />
                      ) : (
                        <Laptop size={20} strokeWidth={2} />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-navy">
                          {s.deviceLabel || "Web Browser"}
                        </span>
                        {s.current ? (
                          <span className="rounded-full bg-emerald/15 px-2 py-0.5 text-[10.5px] font-bold text-emerald uppercase">
                            Current Device
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[12px] text-ink-soft">
                        <span>Last active {formatSessionWhen(s.lastUsedAt)}</span>
                        {s.ip ? <span className="font-mono text-[11.5px] text-ink-faint">· {s.ip}</span> : null}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink-faint">
                        Signed in {formatSessionWhen(s.createdAt)} · Expires {formatSessionWhen(s.expiresAt)}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={s.current ? "danger" : "ghost"}
                    size="sm"
                    disabled={revoking || revokingOthers}
                    onClick={() => onRevoke(s.id, s.current)}
                    className={!s.current ? "text-danger hover:bg-danger/10" : ""}
                  >
                    <LogOut size={13} strokeWidth={2} />
                    <span>{s.current ? "Sign Out" : "Revoke"}</span>
                  </Button>
                </div>
              );
            })}
          </div>

          {sessions.some((s) => !s.current) ? (
            <div className="mt-4 pt-3 border-t border-black/6 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
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

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global auth session (Module 00 — Foundation & Security).
 *
 * Access JWT lives in memory only (Zustand) for Bearer Authorization used by RTK Query.
 * It is NOT persisted to localStorage. Refresh credentials are HttpOnly cookies set by
 * the API (`fo_refresh`) and are never readable by frontend JS.
 *
 * On reload, `bootstrapSessionFromCookie` (see lib/api/baseApi) uses the HttpOnly
 * refresh cookie + CSRF header to re-issue an access token.
 *
 * `fo_auth` is a non-secret presence cookie (value `1`) for Next `proxy.ts` route
 * gating only — it is NOT the access JWT and is not a credential.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthSession {
  accessToken: string;
  /** Omitted in production browser responses — HttpOnly cookie is the source of truth. */
  refreshToken?: string | null;
  sessionId?: string | null;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

/** Non-secret presence flag for Next proxy — never the JWT. */
export const AUTH_PRESENCE_COOKIE = "fo_auth";
/** @deprecated Legacy export name — equals AUTH_PRESENCE_COOKIE. */
export const ACCESS_COOKIE_NAME = AUTH_PRESENCE_COOKIE;

const PRESENCE_MAX_AGE_S = 60 * 60 * 24 * 30;

export function writePresenceCookie(present: boolean) {
  if (typeof document === "undefined") return;
  if (!present) {
    document.cookie = `${AUTH_PRESENCE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    document.cookie = `fo_access=; path=/; max-age=0; samesite=lax`;
    return;
  }
  document.cookie = `${AUTH_PRESENCE_COOKIE}=1; path=/; max-age=${PRESENCE_MAX_AGE_S}; samesite=lax`;
  document.cookie = `fo_access=; path=/; max-age=0; samesite=lax`;
}

export function hasPresenceCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)fo_auth=1(?:;|$)/.test(document.cookie);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      user: null,
      hasHydrated: false,

      setSession: ({ accessToken, sessionId, user }) => {
        writePresenceCookie(Boolean(accessToken));
        set({
          accessToken,
          refreshToken: null,
          sessionId: sessionId ?? null,
          user,
        });
      },

      clearSession: () => {
        writePresenceCookie(false);
        set({
          accessToken: null,
          refreshToken: null,
          sessionId: null,
          user: null,
        });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "fo-auth",
      partialize: (state) => ({
        // Never persist access/refresh tokens. Only non-secret UX hints.
        sessionId: state.sessionId,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        // Access token is memory-only; bootstrap may restore it via HttpOnly refresh.
        if (state) {
          state.accessToken = null;
          state.refreshToken = null;
        }
        // hasHydrated flipped after bootstrap attempt in AuthBootstrap.
        state?.setHasHydrated?.(false);
      },
    },
  ),
);

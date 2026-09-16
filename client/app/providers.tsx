"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/api/store";
import { API_BASE_URL, CSRF_HEADER } from "@/lib/api/baseApi";
import type { ApiEnvelope } from "@/lib/api/baseApi";
import {
  hasPresenceCookie,
  useAuthStore,
  type AuthSession,
} from "@/store/auth.store";

/**
 * After Zustand rehydrate, restore access JWT via HttpOnly refresh cookie.
 * Never reads refresh tokens from JS storage.
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const { setSession, clearSession, setHasHydrated, accessToken } =
        useAuthStore.getState();

      if (accessToken) {
        setHasHydrated(true);
        return;
      }

      if (!hasPresenceCookie()) {
        clearSession();
        setHasHydrated(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            [CSRF_HEADER]: "1",
          },
          body: JSON.stringify({}),
        });
        const envelope = (await res.json()) as ApiEnvelope<AuthSession>;
        if (cancelled) return;
        if (res.ok && envelope.success && envelope.data?.accessToken) {
          setSession(envelope.data);
        } else {
          clearSession();
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setHasHydrated(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

/** Wraps the app in the Redux `Provider` for RTK Query's `baseApi` (dev guide §4). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </Provider>
  );
}

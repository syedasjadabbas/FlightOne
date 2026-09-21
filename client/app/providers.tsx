"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/lib/api/store";
import {
  refreshSessionOnce,
  startProactiveRefreshScheduler,
} from "@/lib/auth/refreshSession";
import { hasPresenceCookie, useAuthStore } from "@/store/auth.store";

/**
 * After Zustand rehydrate, restore access JWT via HttpOnly refresh cookie.
 * Never reads refresh tokens from JS storage.
 * Shares `refreshSessionOnce` with RTK Query reauth so reload never double-rotates.
 * Arms proactive silent refresh so access JWT expiry does not force a 401 round-trip.
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let stopProactive: (() => void) | undefined;

    async function bootstrap() {
      const { setHasHydrated, accessToken } = useAuthStore.getState();

      if (accessToken) {
        setHasHydrated(true);
        if (!cancelled) stopProactive = startProactiveRefreshScheduler();
        return;
      }

      if (!hasPresenceCookie()) {
        useAuthStore.getState().clearSession();
        setHasHydrated(true);
        return;
      }

      try {
        // Bound wait so a hung refresh never leaves the app on a forever spinner.
        await Promise.race([
          refreshSessionOnce({ force: true }),
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(false), 8_000);
          }),
        ]);
      } finally {
        if (!cancelled) {
          setHasHydrated(true);
          stopProactive = startProactiveRefreshScheduler();
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      stopProactive?.();
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

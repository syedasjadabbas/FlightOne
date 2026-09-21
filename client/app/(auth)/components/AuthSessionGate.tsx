"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";

/**
 * If the traveller is already signed in, leave auth forms for the intended
 * destination (redirect query or /chat). Keeps login/signup from racing refresh.
 */
export function AuthSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!hasHydrated || !accessToken) return;
    const target = searchParams.get("redirect") || "/chat";
    router.replace(target);
  }, [hasHydrated, accessToken, router, searchParams]);

  if (!hasHydrated) {
    return (
      <div className="fo-auth__boot" role="status" aria-live="polite">
        <Spinner label="Loading…" />
        <p className="fo-auth__boot-label">Preparing secure sign-in</p>
      </div>
    );
  }

  if (accessToken) {
    return (
      <div className="fo-auth__boot" role="status" aria-live="polite">
        <Spinner label="Redirecting…" />
        <p className="fo-auth__boot-label">You&apos;re already signed in</p>
      </div>
    );
  }

  return <>{children}</>;
}

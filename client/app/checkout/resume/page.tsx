"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui";
import { startCheckout, takePendingCheckout } from "@/lib/bookings/startCheckout";

/**
 * Post-login checkout continuation.
 *
 * "View Deal" while signed out used to send the traveller to
 * `/chat?resumeCheckout=true`, so login landed on the chat page, mounted the
 * whole console, and only then bounced to the traveller details page — the
 * visible "redirects to chat first" detour. Login now returns here instead:
 * this route does nothing but quote the stashed offer and forward.
 */
export default function CheckoutResumePage() {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [error, setError] = useState<string | null>(null);
  // The offer is cleared from sessionStorage on read, so a second effect pass
  // (StrictMode, token refresh) would otherwise find nothing and report failure.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || startedRef.current) return;

    if (!accessToken) {
      router.replace(`/login?redirect=${encodeURIComponent("/checkout/resume")}`);
      return;
    }

    const offer = takePendingCheckout();
    if (!offer) {
      router.replace("/chat");
      return;
    }

    startedRef.current = true;
    void startCheckout(offer, accessToken).then((result) => {
      if (result.ok) {
        router.replace(`/checkout/${result.bookingId}`);
      } else {
        setError(result.message);
      }
    });
  }, [hasHydrated, accessToken, router]);

  return (
    <main className="fo-checkout w-full pb-10">
      <div className="fo-desk__panel mx-auto mt-16 max-w-md p-8 text-center" role="status" aria-live="polite">
        {error ? (
          <>
            <h1 className="fo-desk__title">Couldn&apos;t continue checkout</h1>
            <p className="fo-desk__lede mt-2">{error}</p>
            <Button className="mt-6" onClick={() => router.replace("/chat")}>
              Back to search
            </Button>
          </>
        ) : (
          <>
            <h1 className="fo-desk__title">Preparing your booking…</h1>
            <p className="fo-desk__lede mt-2">
              Confirming the fare and opening traveller details.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

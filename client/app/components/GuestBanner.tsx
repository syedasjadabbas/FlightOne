"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

/** Guest-only — chats aren’t saved until sign-in. No post-auth chrome. */
export function GuestBanner() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  if (!hasHydrated || isAuthenticated) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/95 px-3 py-1.5 text-xs text-[var(--ink-soft)]">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--electric)]"
        aria-hidden
      />
      <span className="hidden sm:inline">Chats aren&apos;t saved until you sign in.</span>
      <span className="sm:hidden">Sign in to save chats</span>
      <Link
        href="/login?redirect=/chat"
        className="font-semibold text-[var(--electric)] underline-offset-2 hover:underline"
      >
        Sign in
      </Link>
    </div>
  );
}

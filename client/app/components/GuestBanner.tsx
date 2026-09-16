"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

/** Guest-only — chats aren’t saved until sign-in. No post-auth chrome. */
export function GuestBanner() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  if (!hasHydrated || isAuthenticated) return null;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white/90 backdrop-blur-xs px-3.5 py-1.5 text-xs text-slate-600 shadow-2xs">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 ring-2 ring-cyan-500/20" aria-hidden />
      <span>Chats aren&apos;t saved until you sign in.</span>
      <Link
        href="/login?redirect=/chat"
        className="font-semibold text-cyan-600 hover:text-cyan-700 hover:underline ml-1"
      >
        Sign in
      </Link>
    </div>
  );
}

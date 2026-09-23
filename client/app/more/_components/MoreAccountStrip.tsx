"use client";

import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useLogoutMutation } from "@/lib/api/auth.api";
import { useGetProfileQuery } from "@/lib/api/profile.api";

export function MoreAccountStrip() {
  const authUser = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile } = useGetProfileQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  if (!authUser) return null;

  const profileMeta = (
    profile?.metadata && typeof profile.metadata === "object" ? profile.metadata : {}
  ) as Record<string, unknown>;
  const avatarUrl =
    typeof profileMeta.avatarUrl === "string" && profileMeta.avatarUrl.trim()
      ? profileMeta.avatarUrl.trim()
      : undefined;

  const displayName = profile?.displayName || authUser.name || "Traveller";
  const initial = displayName.trim().charAt(0).toUpperCase() || "T";

  return (
    <div className="fo-more__account">
      <div className="fo-more__account-id">
        <span className="relative flex fo-more__avatar overflow-hidden items-center justify-center" aria-hidden>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0">
          <p className="fo-more__account-name">{displayName}</p>
          <p className="fo-more__account-email">{authUser.email}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={isLoggingOut}
        onClick={() => void logout()}
        className="text-[var(--ink-faint)] hover:text-[var(--danger)]"
      >
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

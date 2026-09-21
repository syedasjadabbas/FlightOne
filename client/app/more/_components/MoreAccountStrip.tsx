"use client";

import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useLogoutMutation } from "@/lib/api/auth.api";

export function MoreAccountStrip() {
  const authUser = useAuthStore((s) => s.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  if (!authUser) return null;

  const label = authUser.name || authUser.email || "Traveller";
  const initial = label.trim().charAt(0).toUpperCase() || "T";

  return (
    <div className="fo-more__account">
      <div className="fo-more__account-id">
        <span className="fo-more__avatar" aria-hidden>
          {initial}
        </span>
        <div className="min-w-0">
          <p className="fo-more__account-name">{authUser.name || "Traveller"}</p>
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

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

export function GroupLoading() {
  return (
    <div className="flex justify-center py-16" role="status" aria-live="polite">
      <Spinner />
    </div>
  );
}

export function GroupSignInPrompt() {
  return (
    <div className="fo-gm-status">
      <p className="fo-gm-empty__title">Sign in to open this group</p>
      <p className="fo-gm-empty__body">
        Group itineraries, check-ins, and shared documents stay behind your account.
      </p>
      <Link href="/login?redirect=%2Fgroups" className="fo-gm-link fo-gm-link--action">
        <LogIn className="h-3.5 w-3.5" aria-hidden />
        Sign in
      </Link>
    </div>
  );
}

export function GroupLoadError({
  forbidden,
  onRetry,
}: {
  forbidden: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="fo-gm-status">
      <p className="fo-gm-msg fo-gm-msg--danger">
        {forbidden ? "You don’t have access to this group." : "Could not load this group."}
      </p>
      <div className="fo-gm-status__actions">
        <Button type="button" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Link href="/groups" className="fo-gm-link fo-gm-link--action">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to groups
        </Link>
      </div>
    </div>
  );
}

export function GroupChip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "ok" | "warn" | "muted" | "danger";
}) {
  const toneClass =
    tone === "accent" || tone === "ok"
      ? "fo-gm-chip fo-gm-chip--ok"
      : tone === "warn"
        ? "fo-gm-chip fo-gm-chip--warn"
        : tone === "muted"
          ? "fo-gm-chip fo-gm-chip--muted"
          : tone === "danger"
            ? "fo-gm-chip fo-gm-chip--danger"
            : "fo-gm-chip";
  return <span className={toneClass}>{children}</span>;
}

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Lock } from "lucide-react";
import { Button, Spinner, buttonClassName } from "@/components/ui";

export function GroupLoading() {
  return (
    <div className="fo-groups__boot" role="status" aria-live="polite">
      <Spinner label="Loading group…" />
      <p className="fo-groups__boot-label">Loading group</p>
    </div>
  );
}

export function GroupSignInPrompt({ redirectPath = "/groups" }: { redirectPath?: string }) {
  const href = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  return (
    <div className="fo-groups__gate">
      <div className="fo-groups__gate-box">
        <div className="fo-groups__gate-icon" aria-hidden>
          <Lock size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-groups__gate-title">Authentication Required</h2>
        <p className="fo-groups__gate-desc">
          Group itineraries, check-ins, and shared documents stay behind your account.
        </p>
        <Link href={href} className={buttonClassName({ size: "md" })}>
          Sign In to FlightOne
        </Link>
      </div>
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
    <div className="fo-groups__gate">
      <div className="fo-groups__gate-box">
        <div className="fo-groups__gate-icon fo-groups__gate-icon--warn" aria-hidden>
          <AlertCircle size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-groups__gate-title">
          {forbidden ? "Access Restricted" : "Group Unavailable"}
        </h2>
        <p className="fo-groups__gate-desc">
          {forbidden
            ? "You don’t have access to this group."
            : "Could not load this group. Check connectivity and try again."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="md" variant="secondary" onClick={onRetry}>
            Retry Connection
          </Button>
          <Link href="/groups">
            <Button type="button" size="md" variant="ghost" icon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden />}>
              Back to groups
            </Button>
          </Link>
        </div>
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

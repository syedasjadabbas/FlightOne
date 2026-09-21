import Link from "next/link";
import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

export function OpsHubBoot() {
  return (
    <div className="fo-ops__boot" role="status" aria-live="polite">
      <Spinner label="Loading operations…" />
      <p className="fo-ops__boot-label">Loading operations desk</p>
    </div>
  );
}

export function OpsSignInGate() {
  return (
    <div className="fo-ops__gate">
      <div className="fo-ops__gate-box">
        <div className="fo-ops__gate-icon" aria-hidden>
          <Lock size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-ops__gate-title">Authentication Required</h2>
        <p className="fo-ops__gate-body">
          Operations is limited to authenticated FlightOne staff. Sign in with verified credentials
          and complete two-factor authentication when prompted.
        </p>
        <div className="fo-ops__gate-actions">
          <Link href="/login?redirect=%2Fops">
            <Button size="md">Sign In to FlightOne</Button>
          </Link>
          <Link href="/">
            <Button size="md" variant="secondary">
              Back to portal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function OpsPermissionGate() {
  return (
    <div className="fo-ops__gate">
      <div className="fo-ops__gate-box">
        <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
          <ShieldAlert size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-ops__gate-title">Access Restricted</h2>
        <p className="fo-ops__gate-body">
          Your account is signed in but lacks <code>ops:dashboard:read</code>. Access is granted to
          SuperAdmin, OpsManager, TravelConsultant, and FinanceOfficer roles.
        </p>
        <div className="fo-ops__gate-actions">
          <Link href="/ops/escalations">
            <Button size="md" variant="secondary">
              Escalations
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="md" variant="ghost">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function OpsPanelError({
  title = "Could not load this section",
  body = "Check connectivity or permissions, then retry.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="fo-ops__panel-state fo-ops__panel-state--error" role="alert">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <AlertTriangle size={18} strokeWidth={2} />
      </div>
      <p className="fo-ops__panel-state-title">{title}</p>
      <p className="fo-ops__panel-state-body">{body}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry Connection
        </Button>
      ) : null}
    </div>
  );
}

export function OpsPanelEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="fo-ops__panel-state">
      <p className="fo-ops__panel-state-title">{title}</p>
      {body ? <p className="fo-ops__panel-state-body">{body}</p> : null}
    </div>
  );
}

export function OpsTabLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="fo-ops__tab-loading" role="status" aria-live="polite">
      <Spinner size="sm" label={label} />
      {label}
    </div>
  );
}

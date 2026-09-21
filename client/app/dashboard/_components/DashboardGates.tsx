import Link from "next/link";
import { Lock, ShieldAlert, AlertTriangle } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

export function DashboardBoot() {
  return (
    <div className="fo-dash__boot" role="status" aria-live="polite">
      <Spinner label="Loading dashboard…" />
      <p className="fo-dash__boot-label">Loading management dashboard</p>
    </div>
  );
}

export function DashboardSignInGate() {
  return (
    <div className="fo-dash__gate">
      <div className="fo-dash__gate-box">
        <div className="fo-dash__gate-icon" aria-hidden>
          <Lock size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-dash__gate-title">Authentication Required</h2>
        <p className="fo-dash__gate-desc">
          Sign in with a management account to view booking volume, revenue, and ops health.
        </p>
        <div className="fo-dash__gate-actions">
          <Link href="/login?redirect=%2Fdashboard">
            <Button size="md">Sign In to FlightOne</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DashboardPermissionGate() {
  return (
    <div className="fo-dash__gate">
      <div className="fo-dash__gate-box">
        <div className="fo-dash__gate-icon fo-dash__gate-icon--warn" aria-hidden>
          <ShieldAlert size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-dash__gate-title">Access Restricted</h2>
        <p className="fo-dash__gate-desc">
          Your account needs <code>ops:dashboard:read</code> or <code>dashboard:read</code>. Ask a
          FlightOne admin for reporting access.
        </p>
        <div className="fo-dash__gate-actions">
          <Link href="/ops">
            <Button size="md" variant="secondary">
              Operations
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DashboardErrorGate({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fo-dash__gate">
      <div className="fo-dash__gate-box">
        <div className="fo-dash__gate-icon fo-dash__gate-icon--warn" aria-hidden>
          <AlertTriangle size={22} strokeWidth={2} />
        </div>
        <h2 className="fo-dash__gate-title">Dashboard Unavailable</h2>
        <p className="fo-dash__gate-desc">
          Could not load overview metrics. Check connectivity or server logs, then retry.
        </p>
        <div className="fo-dash__gate-actions">
          <Button size="md" variant="secondary" onClick={onRetry}>
            Retry Connection
          </Button>
        </div>
      </div>
    </div>
  );
}

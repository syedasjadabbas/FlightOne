import Link from "next/link";
import { Inbox, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";

export function QueueSignInGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon" aria-hidden>
        <Lock className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Staff sign-in required</h1>
      <p className="fo-ops__gate-body">
        The consultant queue is limited to authenticated FlightOne staff. Sign in to view
        priority-ordered handoffs.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/login?redirect=%2Fops%2Fescalations">
          <Button size="sm">Staff sign in</Button>
        </Link>
        <Link href="/ops">
          <Button size="sm" variant="secondary">
            Operations
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function QueuePermissionGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <ShieldAlert className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Permission required</h1>
      <p className="fo-ops__gate-body">
        Your account is signed in but lacks <code>ops:escalations:read</code>. Ask an admin to
        grant consultant queue access.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/escalations">
          <Button size="sm" variant="secondary">
            Your customer escalations
          </Button>
        </Link>
        <Link href="/ops">
          <Button size="sm" variant="ghost">
            Operations
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function QueueEmpty() {
  return (
    <div className="fo-ops__panel-state" role="status">
      <Inbox className="h-4 w-4 text-ink-faint" strokeWidth={2} aria-hidden />
      <p className="fo-ops__panel-state-title">No cases in this filter</p>
      <p className="fo-ops__panel-state-body">
        Try another status or pool, or clear filters to see the full queue.
      </p>
    </div>
  );
}

export function QueueError({
  unauthorized,
  onRetry,
}: {
  unauthorized: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="fo-ops__panel-state fo-ops__panel-state--error" role="alert">
      <ShieldAlert className="h-4 w-4 text-danger" strokeWidth={2} aria-hidden />
      <p className="fo-ops__panel-state-title">
        {unauthorized ? "Not authorized for the ops queue" : "Could not load queue"}
      </p>
      <p className="fo-ops__panel-state-body">
        {unauthorized
          ? "Your session may lack the required permission, or it expired."
          : "Check your connection and try again."}
      </p>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Retry
      </Button>
    </div>
  );
}

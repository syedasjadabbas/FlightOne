import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";

export function CaseLoading({ label = "Loading case" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16" role="status">
      <Spinner />
      <p className="m-0 text-sm text-ink-soft">{label}…</p>
    </div>
  );
}

export function CaseSignInGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon" aria-hidden>
        <Lock className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Staff sign-in required</h1>
      <p className="fo-ops__gate-body">
        Escalation detail is limited to authenticated FlightOne staff.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/login?redirect=%2Fops%2Fescalations">
          <Button size="sm">Staff sign in</Button>
        </Link>
        <Link href="/ops/escalations">
          <Button size="sm" variant="secondary">
            Back to queue
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function CasePermissionGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <ShieldAlert className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Permission required</h1>
      <p className="fo-ops__gate-body">
        Your account lacks <code>ops:escalations:read</code>. Ask an Ops manager to grant access.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/ops/escalations">
          <Button size="sm" variant="secondary">
            Queue
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

export function CaseLoadError({
  notFound,
  onRetry,
}: {
  notFound: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="fo-ops__gate" role="alert">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <CircleAlert className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">
        {notFound ? "Escalation not found" : "Could not load escalation"}
      </h1>
      <p className="fo-ops__gate-body">
        {notFound
          ? "This case id does not exist or is outside your queue."
          : "The desk could not reach the escalations service. Retry in a moment."}
      </p>
      <div className="fo-ops__gate-actions">
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Retry
        </Button>
        <Link href="/ops/escalations" className="fo-ops-case__back">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Queue
        </Link>
      </div>
    </div>
  );
}

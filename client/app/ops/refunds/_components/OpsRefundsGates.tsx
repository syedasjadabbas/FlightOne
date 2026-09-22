import Link from "next/link";
import { Inbox, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";

export function OpsRefundsSignInGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon" aria-hidden>
        <Lock className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Staff sign-in required</h1>
      <p className="fo-ops__gate-body">
        The refunds ops queue is limited to authenticated FlightOne staff with refund permissions.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/login?redirect=%2Fops%2Frefunds">
          <Button size="sm">Staff sign in</Button>
        </Link>
        <Link href="/ops">
          <Button size="sm" variant="secondary">
            Back to operations
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function OpsRefundsPermissionGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <ShieldAlert className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Permission required</h1>
      <p className="fo-ops__gate-body">
        Your account is signed in but lacks <code>refunds:read</code>. Ask an admin to grant
        refund access for your role.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/refunds">
          <Button size="sm" variant="secondary">
            Customer refunds
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

export function OpsRefundsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="fo-ops__panel-state fo-ops-refunds__empty">
      <div className="fo-ops-refunds__empty-icon" aria-hidden>
        <Inbox className="h-4 w-4" strokeWidth={2} />
      </div>
      <p className="fo-ops-refunds__empty-title">
        {filtered ? "No cases in this filter" : "No refund cases"}
      </p>
      <p className="fo-ops-refunds__empty-body">
        {filtered
          ? "Try another status filter, or switch to All to see the full queue."
          : "When travellers submit refund, cancellation, or reissue cases, they appear here for processing."}
      </p>
    </div>
  );
}

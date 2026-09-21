import Link from "next/link";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";

export function OpsSignInGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon" aria-hidden>
        <Lock className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Staff sign-in required</h1>
      <p className="fo-ops__gate-body">
        Operations is limited to authenticated FlightOne staff. Sign in with verified credentials
        and complete two-factor authentication when prompted.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/login?redirect=%2Fops">
          <Button size="sm">Staff sign in</Button>
        </Link>
        <Link href="/">
          <Button size="sm" variant="secondary">
            Back to portal
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function OpsPermissionGate() {
  return (
    <div className="fo-ops__gate" role="status">
      <div className="fo-ops__gate-icon fo-ops__gate-icon--warn" aria-hidden>
        <ShieldAlert className="h-4 w-4" strokeWidth={2} />
      </div>
      <h1 className="fo-ops__gate-title">Permission required</h1>
      <p className="fo-ops__gate-body">
        Your account is signed in but lacks{" "}
        <code>ops:dashboard:read</code>. Access is granted to SuperAdmin, OpsManager,
        TravelConsultant, and FinanceOfficer roles.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/ops/escalations">
          <Button size="sm" variant="secondary">
            Escalations
          </Button>
        </Link>
        <Link href="/ops/refunds">
          <Button size="sm" variant="secondary">
            Refunds
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button size="sm" variant="ghost">
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

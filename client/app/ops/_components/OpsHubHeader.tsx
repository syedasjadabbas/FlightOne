import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
} from "lucide-react";

const QUEUES = [
  { href: "/ops/escalations", label: "Escalations", Icon: LifeBuoy },
  { href: "/ops/refunds", label: "Refunds", Icon: Receipt },
  { href: "/ops/knowledge", label: "Knowledge", Icon: BookOpen },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
] as const;

export function OpsHubHeader() {
  return (
    <>
      <div className="fo-ops__nav-rail">
        <span className="fo-ops__brand-badge">
          <span className="fo-ops__brand-dot" aria-hidden />
          Operations
        </span>
        <nav className="fo-ops__queues" aria-label="Related queues">
          {QUEUES.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="fo-ops__queue">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <header className="fo-ops__hero">
        <h1 className="fo-ops__title">Operations</h1>
        <p className="fo-ops__lede">
          Integration health, outbox, finance visibility, commissions, reconciliation, and audit.
          External systems stay unconfigured until credentials are set.
        </p>
      </header>
    </>
  );
}

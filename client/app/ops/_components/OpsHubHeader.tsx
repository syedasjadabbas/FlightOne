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
    <header className="fo-desk__header">
      <p className="fo-ops__eyebrow">Operations desk</p>
      <h1 className="fo-desk__title">Operations</h1>
      <p className="fo-desk__lede">
        Integration health, outbox, finance visibility, commissions, reconciliation, and audit.
        External systems stay unconfigured until credentials are set.
      </p>
      <nav className="fo-ops__queues" aria-label="Related queues">
        {QUEUES.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="fo-ops__queue">
            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

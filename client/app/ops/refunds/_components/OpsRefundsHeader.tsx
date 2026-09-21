import Link from "next/link";
import { ArrowLeft, LayoutDashboard, LifeBuoy, UserRound } from "lucide-react";

const QUEUES = [
  { href: "/ops", label: "Operations", Icon: ArrowLeft },
  { href: "/ops/escalations", label: "Escalations", Icon: LifeBuoy },
  { href: "/refunds", label: "Customer refunds", Icon: UserRound },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
] as const;

export function OpsRefundsHeader() {
  return (
    <header className="fo-desk__header">
      <p className="fo-ops__eyebrow">Operations desk</p>
      <h1 className="fo-desk__title">Refunds queue</h1>
      <p className="fo-desk__lede">
        Process confirms completion only when payment and supplier paths succeed — otherwise the
        case stays REQUIRES_HUMAN or FAILED. Exchange and reissue remain human-owned until an agent
        finishes the ticket change outside live GDS mutation.
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

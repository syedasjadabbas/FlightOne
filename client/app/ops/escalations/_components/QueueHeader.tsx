import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";

const QUEUES = [
  { href: "/ops", label: "Operations", Icon: ArrowLeft },
  { href: "/escalations", label: "Customer escalations", Icon: MessageCircle },
] as const;

export function QueueHeader() {
  return (
    <>
      <div className="fo-ops__nav-rail">
        <span className="fo-ops__brand-badge">
          <span className="fo-ops__brand-dot" aria-hidden />
          Escalations
        </span>
        <nav className="fo-ops__queues" aria-label="Queue navigation">
          {QUEUES.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="fo-ops__queue">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <header className="fo-ops__hero">
        <h1 className="fo-ops__title">Consultant queue</h1>
        <p className="fo-ops__lede">
          Priority-ordered handoffs with pool routing. Open a case for full conversation history.
          Routing never invents consultant availability.
        </p>
      </header>
    </>
  );
}

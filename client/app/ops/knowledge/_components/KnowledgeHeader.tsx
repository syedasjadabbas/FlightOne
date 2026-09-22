import Link from "next/link";
import { ArrowLeft, BookOpen, LifeBuoy, Receipt } from "lucide-react";

const QUEUES = [
  { href: "/ops", label: "Operations", Icon: ArrowLeft },
  { href: "/ops/escalations", label: "Escalations", Icon: LifeBuoy },
  { href: "/ops/refunds", label: "Refunds", Icon: Receipt },
] as const;

export function KnowledgeHeader() {
  return (
    <>
      <div className="fo-ops__nav-rail">
        <span className="fo-ops__brand-badge">
          <span className="fo-ops__brand-dot" aria-hidden />
          Knowledge
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
        <h1 className="fo-ops__title inline-flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 shrink-0 text-sky" strokeWidth={2} aria-hidden />
          Knowledge base
        </h1>
        <p className="fo-ops__lede">
          Authoritative SOPs and policies for Ava grounding. Publish only verified content — never
          invent policy.
        </p>
      </header>
    </>
  );
}

export function KnowledgePermissionFallback() {
  return (
    <div className="fo-ops__gate" role="status">
      <h1 className="fo-ops__gate-title">Knowledge base</h1>
      <p className="fo-ops__gate-body">
        Missing <code>knowledge:read</code> or <code>ops:dashboard:read</code>. Ask an OpsManager
        to grant access.
      </p>
      <div className="fo-ops__gate-actions">
        <Link href="/ops" className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Operations
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, BookOpen, LifeBuoy, Receipt } from "lucide-react";

const QUEUES = [
  { href: "/ops/escalations", label: "Escalations", Icon: LifeBuoy },
  { href: "/ops/refunds", label: "Refunds", Icon: Receipt },
] as const;

export function KnowledgeHeader() {
  return (
    <header className="fo-desk__header">
      <p className="fo-ops__eyebrow">Operations desk</p>
      <h1 className="fo-desk__title inline-flex items-center gap-2.5">
        <BookOpen className="h-5 w-5 shrink-0 text-[var(--cyan)]" strokeWidth={2} aria-hidden />
        Knowledge base
      </h1>
      <p className="fo-desk__lede">
        Authoritative SOPs and policies for Ava grounding. Publish only verified content — never
        invent policy.
      </p>
      <div className="fo-desk__links">
        <Link href="/ops" className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Operations
        </Link>
      </div>
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

export function KnowledgePermissionFallback() {
  return (
    <header className="fo-desk__header">
      <p className="fo-ops__eyebrow">Operations desk</p>
      <h1 className="fo-desk__title">Knowledge base</h1>
      <p className="fo-desk__lede">
        Missing <code className="fo-kb__code">knowledge:read</code> or{" "}
        <code className="fo-kb__code">ops:dashboard:read</code>. Ask an OpsManager to grant access.
      </p>
      <div className="fo-desk__links">
        <Link href="/ops" className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Operations
        </Link>
      </div>
    </header>
  );
}

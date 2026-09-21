import Link from "next/link";
import { ArrowLeft, LifeBuoy, MessageCircle } from "lucide-react";

export function QueueHeader() {
  return (
    <header className="fo-desk__header">
      <p className="fo-ops-eq__eyebrow">Operations desk</p>
      <div className="fo-ops-eq__title-row">
        <span className="fo-ops-eq__title-icon" aria-hidden>
          <LifeBuoy className="h-4 w-4" strokeWidth={2} />
        </span>
        <h1 className="fo-desk__title">Consultant queue</h1>
      </div>
      <p className="fo-desk__lede">
        Priority-ordered handoffs with pool routing. Open a case for full conversation history.
        Routing never invents consultant availability.
      </p>
      <nav className="fo-ops-eq__nav" aria-label="Queue navigation">
        <Link href="/ops">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Operations
        </Link>
        <Link href="/escalations">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Customer escalations
        </Link>
      </nav>
    </header>
  );
}

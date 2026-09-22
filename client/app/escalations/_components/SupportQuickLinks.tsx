import Link from "next/link";
import { Map, MessageCircle, Stamp, Undo2, type LucideIcon } from "lucide-react";

const LINKS: {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/chat",
    label: "Chat with Ava",
    hint: "Live trip questions",
    icon: MessageCircle,
  },
  {
    href: "/journey",
    label: "My Journey",
    hint: "Gates & delays",
    icon: Map,
  },
  {
    href: "/refunds",
    label: "Refunds",
    hint: "Claims & eligibility",
    icon: Undo2,
  },
  {
    href: "/visa",
    label: "Visa advisory",
    hint: "Entry rules",
    icon: Stamp,
  },
];

export function SupportQuickLinks() {
  return (
    <nav aria-label="Related desks" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {LINKS.map(({ href, label, hint, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-start gap-2.5 rounded-2xl border border-transparent bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(14,22,32,0.04),inset_0_1px_0_#ffffff] transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(14,22,32,0.08),inset_0_1px_0_#ffffff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sky)]"
        >
          <span className="mt-0.5 shrink-0 text-[var(--sky)]">
            <Icon size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-[var(--navy)]">{label}</span>
            <span className="block text-[11px] text-[var(--ink-faint)]">{hint}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

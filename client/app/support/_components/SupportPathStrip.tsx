import Link from "next/link";
import { SUPPORT_PATHS } from "./supportContent";

export function SupportPathStrip() {
  return (
    <nav aria-label="How to get help" className="fo-support__paths">
      {SUPPORT_PATHS.map(({ href, title, description, icon: Icon }) => (
        <Link key={href} href={href} className="fo-support__path">
          <span className="fo-support__path-icon" aria-hidden>
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="fo-support__path-title">{title}</span>
            <span className="fo-support__path-desc block">{description}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

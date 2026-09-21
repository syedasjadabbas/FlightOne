import Link from "next/link";
import { TravellerSection } from "@/app/components/traveller";
import { SUPPORT_RELATED } from "./supportContent";

export function SupportRelatedDesks() {
  return (
    <TravellerSection title="Related desks">
      <nav aria-label="Related desks" className="fo-support__related">
        {SUPPORT_RELATED.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="fo-support__related-link">
            <span className="fo-support__related-icon" aria-hidden>
              <Icon size={16} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="fo-support__related-label block">{label}</span>
              <span className="fo-support__related-hint block">{hint}</span>
            </span>
          </Link>
        ))}
      </nav>
    </TravellerSection>
  );
}

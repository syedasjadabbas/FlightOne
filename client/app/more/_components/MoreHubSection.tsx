import { TravellerSection } from "@/app/components/traveller";
import type { MoreSection } from "./moreContent";
import { MoreModuleLink } from "./MoreModuleLink";

export function MoreHubSection({ title, description, modules }: MoreSection) {
  return (
    <TravellerSection title={title}>
      <p className="fo-more__section-note">{description}</p>
      <nav aria-label={title} className="fo-more__grid">
        {modules.map((mod) => (
          <MoreModuleLink key={mod.href} {...mod} />
        ))}
      </nav>
    </TravellerSection>
  );
}

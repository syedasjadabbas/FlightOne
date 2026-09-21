"use client";

import { TravellerPageHeader } from "@/app/components/traveller";
import { MORE_SECTIONS } from "./_components/moreContent";
import { MoreAccountStrip } from "./_components/MoreAccountStrip";
import { MoreHubSection } from "./_components/MoreHubSection";

export function MorePageClient() {
  return (
    <div className="fo-more">
      <TravellerPageHeader
        title="More"
        lede="Desks and tools for your trips, documents, and account — organised by job."
      />

      <MoreAccountStrip />

      <div className="fo-more__directory">
        {MORE_SECTIONS.map((section) => (
          <MoreHubSection key={section.title} {...section} />
        ))}
      </div>
    </div>
  );
}

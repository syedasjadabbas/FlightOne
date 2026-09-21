import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MoreModule } from "./moreContent";

export function MoreModuleLink({ title, href, description, icon: Icon }: MoreModule) {
  return (
    <Link href={href} className="fo-more__link">
      <span className="fo-more__link-icon" aria-hidden>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="fo-more__link-title">{title}</span>
        <span className="fo-more__link-desc block">{description}</span>
      </span>
      <ChevronRight className="fo-more__link-chevron" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

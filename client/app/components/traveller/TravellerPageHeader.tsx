import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

export function TravellerPageHeader({
  title,
  lede,
  actions,
  backHref,
  backLabel = "Back",
  meta,
  className,
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("fo-traveller__header", className)}>
      {backHref ? (
        <Link href={backHref} className="fo-traveller__back">
          ← {backLabel}
        </Link>
      ) : null}
      <div className="fo-traveller__header-row">
        <div className="min-w-0 space-y-1.5">
          <h1 className="fo-traveller__title">{title}</h1>
          {lede ? <div className="fo-traveller__lede">{lede}</div> : null}
        </div>
        {actions ? <div className="fo-traveller__actions">{actions}</div> : null}
      </div>
      {meta ? <div className="fo-traveller__meta">{meta}</div> : null}
    </header>
  );
}

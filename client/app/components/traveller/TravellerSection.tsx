import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function TravellerSection({
  title,
  note,
  children,
  panel = false,
  warn = false,
  className,
  actions,
}: {
  title?: string;
  note?: ReactNode;
  children: ReactNode;
  /** Use for interactive forms only — lists stay open. */
  panel?: boolean;
  warn?: boolean;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("fo-traveller__section", className)}>
      {title || actions ? (
        <div className="fo-traveller__section-head">
          {title ? <h2 className="fo-traveller__section-title">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {note ? <div className="fo-traveller__section-note">{note}</div> : null}
      {panel ? (
        <div className={cn("fo-traveller__panel", warn && "fo-traveller__panel--warn")}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

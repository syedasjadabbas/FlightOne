import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function CaseSection({
  icon: Icon,
  title,
  note,
  flush,
  children,
}: {
  icon: LucideIcon;
  title: string;
  note?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`fo-desk__panel fo-ops-case__section${flush ? " fo-desk__panel--flush" : ""}`}
    >
      <div
        className="fo-ops-case__section-head"
        style={flush ? { padding: "0.75rem 1rem 0" } : undefined}
      >
        <h2 className="fo-ops-case__section-title">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {title}
        </h2>
        {note && !flush ? <p className="fo-ops-case__section-note">{note}</p> : null}
      </div>
      {note && flush ? (
        <p className="fo-ops-case__section-note" style={{ padding: "0 1rem" }}>
          {note}
        </p>
      ) : null}
      {children}
    </section>
  );
}

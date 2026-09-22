import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui";

export function GroupSection({
  icon: Icon,
  title,
  hint,
  loading = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="fo-gm-section">
      <h2 className="fo-gm-section__title fo-gm-section__title--icon">
        <Icon className="fo-gm-section__icon" aria-hidden />
        {title}
      </h2>
      {hint ? <p className="fo-gm-section__hint">{hint}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 py-4" role="status">
          <Spinner />
          <p className="m-0 text-sm text-ink-soft">Loading…</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

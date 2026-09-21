import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function GroupSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="fo-gm-section">
      <h2 className="fo-gm-section__title fo-gm-section__title--icon">
        <Icon className="fo-gm-section__icon" aria-hidden />
        {title}
      </h2>
      {hint ? <p className="fo-gm-section__hint">{hint}</p> : null}
      {children}
    </section>
  );
}

import type { LucideIcon } from "lucide-react";

export function GroupEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="fo-gm-empty fo-gm-empty--icon">
      <Icon className="fo-gm-empty__icon" aria-hidden />
      <p className="fo-gm-empty__title">{title}</p>
      <p className="fo-gm-empty__body">{body}</p>
    </div>
  );
}

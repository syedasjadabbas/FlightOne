import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function DeskSectionHead({
  icon: Icon,
  title,
  trailing,
  flush,
}: {
  icon: LucideIcon;
  title: string;
  trailing?: ReactNode;
  /** Match fo-desk__panel--flush padding. */
  flush?: boolean;
}) {
  return (
    <div
      className="fo-desk__panel-head"
      style={flush ? { padding: "0.75rem 1rem 0" } : undefined}
    >
      <h2 className="fo-desk__section-label inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" aria-hidden />
        {title}
      </h2>
      {trailing ?? null}
    </div>
  );
}

export function DeskStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "fo-desk__status fo-desk__status--ok"
      : tone === "warn"
        ? "fo-desk__status fo-desk__status--warn"
        : "fo-desk__status";
  return <span className={cls}>{children}</span>;
}

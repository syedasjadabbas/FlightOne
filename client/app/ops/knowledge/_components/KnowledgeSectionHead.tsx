import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function KnowledgeSectionHead({
  icon: Icon,
  title,
  trailing,
  flush,
}: {
  icon: LucideIcon;
  title: string;
  trailing?: ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className="fo-desk__panel-head"
      style={flush ? { padding: "0.75rem 1rem 0" } : undefined}
    >
      <h2 className="fo-desk__section-label inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-sky" aria-hidden />
        {title}
      </h2>
      {trailing ?? null}
    </div>
  );
}

export function KnowledgeStatus({
  status,
  tone = "neutral",
}: {
  status: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "fo-desk__status fo-desk__status--ok"
      : tone === "warn"
        ? "fo-desk__status fo-desk__status--warn"
        : "fo-desk__status";
  return <span className={cls}>{status}</span>;
}

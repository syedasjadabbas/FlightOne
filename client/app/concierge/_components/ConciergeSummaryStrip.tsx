import { Activity, BellOff, ShieldCheck } from "lucide-react";

type ConciergeSummaryStripProps = {
  activeCount: number;
  pausedCount: number;
  activityCount: number;
};

export function ConciergeSummaryStrip({
  activeCount,
  pausedCount,
  activityCount,
}: ConciergeSummaryStripProps) {
  const cells = [
    {
      label: "Active",
      value: activeCount,
      icon: ShieldCheck,
      note: "watching your trips",
    },
    {
      label: "Paused",
      value: pausedCount,
      icon: BellOff,
      note: "will not fire",
    },
    {
      label: "Activity",
      value: activityCount,
      icon: Activity,
      note: "recent runs",
    },
  ] as const;

  return (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-[0.65rem] border border-[var(--line)] bg-[color-mix(in_oklab,white_94%,var(--horizon-cool))]"
      aria-label="Concierge summary"
    >
      {cells.map(({ label, value, icon: Icon, note }, i) => (
        <div
          key={label}
          className={`min-w-0 px-3 py-3 sm:px-4 sm:py-3.5 ${
            i > 0 ? "border-l border-[var(--line)]" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 text-[var(--ink-faint)]">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
              {label}
            </p>
          </div>
          <p
            className="m-0 mt-1 text-[1.35rem] font-bold leading-none tracking-[-0.03em] text-[var(--navy)] tabular-nums"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            {value}
          </p>
          <p className="m-0 mt-1 hidden text-[0.75rem] text-[var(--ink-faint)] sm:block">
            {note}
          </p>
        </div>
      ))}
    </div>
  );
}

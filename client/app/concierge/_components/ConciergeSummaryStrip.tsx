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
      note: "Watching your trips",
    },
    {
      label: "Paused",
      value: pausedCount,
      icon: BellOff,
      note: "Will not fire",
    },
    {
      label: "Activity",
      value: activityCount,
      icon: Activity,
      note: "Recent runs",
    },
  ] as const;

  return (
    <div className="fo-concierge__summary" aria-label="Concierge summary">
      {cells.map(({ label, value, icon: Icon, note }) => (
        <div key={label} className="fo-concierge__stat">
          <p className="fo-concierge__stat-label">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </p>
          <p className="fo-concierge__stat-value">{value}</p>
          <p className="fo-concierge__stat-note">{note}</p>
        </div>
      ))}
    </div>
  );
}

import { Activity, BellOff, ShieldCheck } from "lucide-react";
import { TravellerStatStrip } from "@/app/components/traveller";

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
  return (
    <TravellerStatStrip
      aria-label="Concierge summary"
      stats={[
        {
          key: "active",
          icon: <ShieldCheck size={12} strokeWidth={2.2} aria-hidden />,
          label: "Active",
          value: activeCount,
          note: "Watching your trips",
          tone: "emerald",
        },
        {
          key: "paused",
          icon: <BellOff size={12} strokeWidth={2} aria-hidden />,
          label: "Paused",
          value: pausedCount,
          note: "Will not fire",
          tone: "amber",
        },
        {
          key: "activity",
          icon: <Activity size={12} strokeWidth={2} aria-hidden />,
          label: "Activity",
          value: activityCount,
          note: "Recent runs",
          tone: "sky",
        },
      ]}
    />
  );
}

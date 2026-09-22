import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export type TravellerStat = {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note: ReactNode;
  tone?: "sky" | "emerald" | "amber" | "danger";
  small?: boolean;
};

export function TravellerStatStrip({
  stats,
  "aria-label": ariaLabel,
}: {
  stats: TravellerStat[];
  "aria-label": string;
}) {
  return (
    <div className="fo-traveller__stat-strip" aria-label={ariaLabel}>
      {stats.map((stat) => (
        <div
          key={stat.key}
          className={cn(
            "fo-traveller__stat",
            stat.tone === "amber" && "fo-traveller__stat--warn",
            stat.tone === "danger" && "fo-traveller__stat--danger",
          )}
        >
          <p
            className={cn(
              "fo-traveller__stat-label",
              stat.tone && `fo-traveller__stat-label--${stat.tone}`,
            )}
          >
            {stat.icon}
            <span>{stat.label}</span>
          </p>
          <p
            className={cn(
              "fo-traveller__stat-value",
              stat.small && "fo-traveller__stat-value--sm",
            )}
          >
            {stat.value}
          </p>
          <p className="fo-traveller__stat-note">{stat.note}</p>
        </div>
      ))}
    </div>
  );
}

"use client";

import { Spinner } from "@/components/ui";
import { TravellerChip, TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  conciergeStatusLabel,
  conciergeStatusTone,
} from "@/lib/concierge/conciergeDisplay";
import type { ConciergeExecution } from "@/lib/api/concierge.api";

type ConciergeActivityListProps = {
  items: ConciergeExecution[] | undefined;
  loading: boolean;
};

export function ConciergeActivityList({ items, loading }: ConciergeActivityListProps) {
  return (
    <TravellerSection
      title="Recent activity"
      note="Quotes and notifications only — never silent tickets."
    >
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Spinner />
          <p className="m-0 text-sm text-ink-soft">Loading activity…</p>
        </div>
      ) : !items?.length ? (
        <TravellerState title="No activity yet">
          When a rule matches a disruption, the run appears here.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {items.map((row) => (
            <li key={row.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TravellerChip tone={conciergeStatusTone(row.status)}>
                      {conciergeStatusLabel(row.status)}
                    </TravellerChip>
                  </div>
                  {row.reason ? (
                    <p className="fo-traveller__row-body">
                      {row.reason.replace(/_/g, " ").toLowerCase()}
                    </p>
                  ) : null}
                </div>
                <time
                  className="fo-traveller__row-meta shrink-0 tabular-nums"
                  dateTime={row.createdAt}
                >
                  {new Date(row.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </TravellerSection>
  );
}

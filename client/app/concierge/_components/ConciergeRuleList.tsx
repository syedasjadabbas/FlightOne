"use client";

import { Button, Spinner } from "@/components/ui";
import { TravellerChip, TravellerSection, TravellerState } from "@/app/components/traveller";
import {
  CONCIERGE_ACTION_LABELS,
  CONCIERGE_TRIGGER_LABELS,
  formatConciergeBudget,
} from "@/lib/concierge/conciergeDisplay";
import type { ConciergeRule } from "@/lib/api/concierge.api";
import { Pause, Play } from "lucide-react";

type ConciergeRuleListProps = {
  rules: ConciergeRule[] | undefined;
  loading: boolean;
  pendingRuleId: string | null;
  onDisable: (ruleId: string) => void;
  onEnable: (ruleId: string) => void;
};

export function ConciergeRuleList({
  rules,
  loading,
  pendingRuleId,
  onDisable,
  onEnable,
}: ConciergeRuleListProps) {
  return (
    <TravellerSection
      title="Your rules"
      note="Enabled rules evaluate on verified disruptions only."
    >
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Spinner />
          <p className="m-0 text-sm text-ink-soft">Loading rules…</p>
        </div>
      ) : !rules?.length ? (
        <TravellerState title="No rules yet">
          Create a rule above to opt in. Nothing runs until you save one.
        </TravellerState>
      ) : (
        <ul className="fo-traveller__list">
          {rules.map((rule) => (
            <li key={rule.id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <div className="min-w-0">
                  <p className="fo-traveller__row-title">{rule.name}</p>
                  <p className="fo-traveller__row-meta">
                    {CONCIERGE_TRIGGER_LABELS[rule.trigger]}
                    {rule.thresholdMinutes != null
                      ? ` · ≥ ${Math.round(rule.thresholdMinutes / 60)}h`
                      : ""}
                    {" · "}
                    {CONCIERGE_ACTION_LABELS[rule.action]}
                    {" · "}
                    {formatConciergeBudget(rule.maxAdditionalMinor, rule.currency)}
                  </p>
                </div>
                <div className="fo-traveller__row-actions items-center">
                  <TravellerChip tone={rule.enabled ? "default" : "muted"}>
                    {rule.enabled ? "Enabled" : "Paused"}
                  </TravellerChip>
                  {rule.enabled ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pendingRuleId === rule.id}
                      icon={<Pause className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => onDisable(rule.id)}
                    >
                      {pendingRuleId === rule.id ? "Pausing…" : "Pause"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pendingRuleId === rule.id}
                      icon={<Play className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => onEnable(rule.id)}
                    >
                      {pendingRuleId === rule.id ? "Enabling…" : "Enable"}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </TravellerSection>
  );
}

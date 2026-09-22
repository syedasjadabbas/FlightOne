"use client";

import { Button, Input } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";
import {
  CONCIERGE_ACTION_LABELS,
  CONCIERGE_TRIGGER_LABELS,
} from "@/lib/concierge/conciergeDisplay";
import type { ConciergeAction, ConciergeTrigger } from "@/lib/api/concierge.api";
import { Plus } from "lucide-react";

type ConciergeRuleFormProps = {
  name: string;
  trigger: ConciergeTrigger;
  thresholdHours: string;
  action: ConciergeAction;
  budgetMajor: string;
  currency: string;
  creating: boolean;
  disabled: boolean;
  message: string | null;
  budgetError?: string | null;
  onNameChange: (v: string) => void;
  onTriggerChange: (v: ConciergeTrigger) => void;
  onThresholdChange: (v: string) => void;
  onActionChange: (v: ConciergeAction) => void;
  onBudgetChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

const NEEDS_THRESHOLD: ConciergeTrigger[] = [
  "DELAY",
  "DISRUPTION",
  "REBOOK_OPPORTUNITY",
];

export function ConciergeRuleForm({
  name,
  trigger,
  thresholdHours,
  action,
  budgetMajor,
  currency,
  creating,
  disabled,
  message,
  budgetError,
  onNameChange,
  onTriggerChange,
  onThresholdChange,
  onActionChange,
  onBudgetChange,
  onCurrencyChange,
  onSubmit,
}: ConciergeRuleFormProps) {
  const showThreshold = NEEDS_THRESHOLD.includes(trigger);

  return (
    <TravellerSection
      title="New rule"
      note="Rules only evaluate verified disruption signals on your own bookings."
      panel
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="fo-traveller__field sm:col-span-2">
          <span>Name</span>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            placeholder="e.g. Rebook if delayed over 2 hours"
          />
        </label>

        <label className="fo-traveller__field">
          <span>When</span>
          <select
            className="fo-traveller__select"
            value={trigger}
            onChange={(e) => onTriggerChange(e.target.value as ConciergeTrigger)}
          >
            {(Object.keys(CONCIERGE_TRIGGER_LABELS) as ConciergeTrigger[]).map((key) => (
              <option key={key} value={key}>
                {CONCIERGE_TRIGGER_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="fo-traveller__field">
          <span>Delay threshold (hours)</span>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={thresholdHours}
            onChange={(e) => onThresholdChange(e.target.value)}
            disabled={!showThreshold}
            aria-describedby={showThreshold ? undefined : "concierge-threshold-hint"}
          />
          {!showThreshold ? (
            <p id="concierge-threshold-hint" className="fo-traveller__field-hint">
              Not used for cancelled itineraries.
            </p>
          ) : null}
        </label>

        <label className="fo-traveller__field">
          <span>Authorised action</span>
          <select
            className="fo-traveller__select"
            value={action}
            onChange={(e) => onActionChange(e.target.value as ConciergeAction)}
          >
            {(Object.keys(CONCIERGE_ACTION_LABELS) as ConciergeAction[]).map((key) => (
              <option key={key} value={key}>
                {CONCIERGE_ACTION_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="fo-traveller__field">
          <span>Max extra amount</span>
          <div className="flex gap-2">
            <Input
              value={budgetMajor}
              onChange={(e) => onBudgetChange(e.target.value)}
              inputMode="decimal"
              aria-label="Maximum extra amount"
              error={budgetError ?? undefined}
              hint={budgetError ? undefined : "Cap on fare difference before a quote is prepared."}
            />
            <Input
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="w-24"
              aria-label="Currency"
              maxLength={3}
            />
          </div>
        </label>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={creating || disabled}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            {creating ? "Saving…" : "Save rule"}
          </Button>
          {message ? (
            <p className="m-0 text-[0.8125rem] leading-snug text-ink-soft" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </form>
    </TravellerSection>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerPageHeader,
  TravellerState,
} from "@/app/components/traveller";
import { useAuthStore } from "@/store/auth.store";
import {
  useConciergeKillSwitchMutation,
  useCreateConciergeRuleMutation,
  useDisableConciergeRuleMutation,
  useListConciergeActivityQuery,
  useListConciergeRulesQuery,
  useUpdateConciergeRuleMutation,
  type ConciergeAction,
  type ConciergeTrigger,
} from "@/lib/api/concierge.api";
import { LogIn, ShieldOff } from "lucide-react";
import { ConciergeSummaryStrip } from "./_components/ConciergeSummaryStrip";
import { ConciergeRuleForm } from "./_components/ConciergeRuleForm";
import { ConciergeRuleList } from "./_components/ConciergeRuleList";
import { formatApiError } from "@/lib/api/formatApiError";
import { ConciergeActivityList } from "./_components/ConciergeActivityList";

export function ConciergePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: rules, isLoading, refetch } = useListConciergeRulesQuery(undefined, { skip });
  const { data: activity, isLoading: activityLoading } = useListConciergeActivityQuery(undefined, {
    skip,
  });
  const [createRule, { isLoading: creating }] = useCreateConciergeRuleMutation();
  const [updateRule] = useUpdateConciergeRuleMutation();
  const [disableRule] = useDisableConciergeRuleMutation();
  const [killSwitch, { isLoading: killing }] = useConciergeKillSwitchMutation();

  const [name, setName] = useState("Rebook if delayed over 2 hours");
  const [trigger, setTrigger] = useState<ConciergeTrigger>("DELAY");
  const [thresholdHours, setThresholdHours] = useState("2");
  const [action, setAction] = useState<ConciergeAction>("PREPARE_REBOOK");
  const [budgetMajor, setBudgetMajor] = useState("20000");
  const [currency, setCurrency] = useState("PKR");
  const [msg, setMsg] = useState<string | null>(null);

  const summary = useMemo(() => {
    const items = rules?.items ?? [];
    return {
      active: items.filter((r) => r.enabled).length,
      paused: items.filter((r) => !r.enabled).length,
      activity: activity?.items?.length ?? 0,
    };
  }, [rules?.items, activity?.items]);

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="space-y-6">
        <TravellerPageHeader
          title="Travel Concierge"
          lede="Pre-authorise delay and disruption rules. OTP, payment, and corporate approval still gate anything irreversible."
        />
        <TravellerState
          title="Sign in to manage rules"
          action={
            <Link href="/login?redirect=/concierge">
              <Button icon={<LogIn className="h-4 w-4" aria-hidden />}>Sign in</Button>
            </Link>
          }
        >
          Concierge rules stay scoped to your traveller account.
        </TravellerState>
      </div>
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const hours = Number(thresholdHours);
    const major = Number(budgetMajor);
    if (!Number.isFinite(major) || major < 0) {
      setMsg("Enter a valid authorised extra budget.");
      return;
    }
    try {
      await createRule({
        name: name.trim(),
        trigger,
        thresholdMinutes:
          trigger === "DELAY" || trigger === "DISRUPTION" || trigger === "REBOOK_OPPORTUNITY"
            ? Math.round(hours * 60)
            : null,
        action,
        maxAdditionalMinor: Math.round(major * 100),
        currency: currency.trim().toUpperCase() || "PKR",
        enabled: true,
        notifyOnTrigger: true,
      }).unwrap();
      setMsg("Rule saved. It only runs on verified disruptions for your bookings.");
      void refetch();
    } catch (err) {
      setMsg(
        formatApiError(err, "That request could not be completed. Nothing was booked."),
      );
    }
  }

  return (
    <div className="space-y-7">
      <TravellerPageHeader
        title="Travel Concierge"
        lede="You set the conditions. FlightOne prepares quotes and alerts — never silent tickets, payments, cancellations, or refunds."
        actions={
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={killing || skip}
            icon={<ShieldOff className="h-3.5 w-3.5" aria-hidden />}
            onClick={async () => {
              setMsg(null);
              try {
                const r = await killSwitch().unwrap();
                setMsg(`All rules paused (${r.disabledCount} disabled).`);
                void refetch();
              } catch (err) {
                setMsg(
        formatApiError(err, "That request could not be completed. Nothing was booked."),
      );
              }
            }}
          >
            {killing ? "Pausing…" : "Pause all"}
          </Button>
        }
        meta={
          <ul className="fo-traveller__meta-list">
            <li>OTP still required</li>
            <li>Payment gates unchanged</li>
            <li>Corporate approval where applicable</li>
          </ul>
        }
      />

      {!isLoading && !activityLoading ? (
        <ConciergeSummaryStrip
          activeCount={summary.active}
          pausedCount={summary.paused}
          activityCount={summary.activity}
        />
      ) : null}

      <ConciergeRuleForm
        name={name}
        trigger={trigger}
        thresholdHours={thresholdHours}
        action={action}
        budgetMajor={budgetMajor}
        currency={currency}
        creating={creating}
        disabled={skip}
        message={msg}
        onNameChange={setName}
        onTriggerChange={setTrigger}
        onThresholdChange={setThresholdHours}
        onActionChange={setAction}
        onBudgetChange={setBudgetMajor}
        onCurrencyChange={setCurrency}
        onSubmit={onCreate}
      />

      <ConciergeRuleList
        rules={rules?.items}
        loading={isLoading}
        onDisable={async (ruleId) => {
          try {
            await disableRule(ruleId).unwrap();
            void refetch();
          } catch (err) {
            setMsg(
        formatApiError(err, "That request could not be completed. Nothing was booked."),
      );
          }
        }}
        onEnable={async (ruleId) => {
          try {
            await updateRule({ ruleId, body: { enabled: true } }).unwrap();
            void refetch();
          } catch (err) {
            setMsg(
        formatApiError(err, "That request could not be completed. Nothing was booked."),
      );
          }
        }}
      />

      <ConciergeActivityList items={activity?.items} loading={activityLoading} />
    </div>
  );
}

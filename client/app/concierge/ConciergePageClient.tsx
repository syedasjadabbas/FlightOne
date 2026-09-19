"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
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
import {
  CONCIERGE_ACTION_LABELS,
  CONCIERGE_TRIGGER_LABELS,
  conciergeStatusLabel,
  formatConciergeBudget,
} from "@/lib/concierge/conciergeDisplay";

function formatApiError(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const msg = (err as { data?: { message?: string } }).data?.message;
    if (msg && !/prisma|econnrefused|stack/i.test(msg)) return msg;
  }
  return "That request could not be completed. Nothing was booked.";
}

export function ConciergePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const { data: rules, isLoading, refetch } = useListConciergeRulesQuery(undefined, { skip });
  const { data: activity, isLoading: activityLoading } = useListConciergeActivityQuery(undefined, { skip });
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

  if (hasHydrated && !accessToken) {
    return (
      <div className="space-y-6">
        <TravellerPageHeader
          title="Autonomous Travel Concierge"
          lede="Pre-authorise delay and disruption rules. FlightOne still requires OTP, payment, and corporate approval before anything irreversible."
        />
        <TravellerState
          title="Sign in to manage rules"
          action={
            <Link href="/login?redirect=/concierge">
              <Button>Sign in</Button>
            </Link>
          }
        >
          Autonomous rules are scoped to your traveller account only.
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
        thresholdMinutes: trigger === "DELAY" || trigger === "DISRUPTION" || trigger === "REBOOK_OPPORTUNITY"
          ? Math.round(hours * 60)
          : null,
        action,
        maxAdditionalMinor: Math.round(major * 100),
        currency: currency.trim().toUpperCase() || "PKR",
        enabled: true,
        notifyOnTrigger: true,
      }).unwrap();
      setMsg("Rule saved. It will only run on verified disruptions for your bookings.");
      void refetch();
    } catch (err) {
      setMsg(formatApiError(err));
    }
  }

  return (
    <div className="space-y-8">
      <TravellerPageHeader
        title="Autonomous Travel Concierge"
        lede="You authorise the conditions. FlightOne never silently tickets, pays, cancels, or refunds — even when a rule matches."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={killing || skip}
            onClick={async () => {
              setMsg(null);
              try {
                const r = await killSwitch().unwrap();
                setMsg(`All autonomous rules are off (${r.disabledCount} disabled).`);
                void refetch();
              } catch (err) {
                setMsg(formatApiError(err));
              }
            }}
          >
            Disable all rules
          </Button>
        }
      />

      <TravellerSection title="New rule">
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-slate-600">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">When</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as ConciergeTrigger)}
            >
              {(Object.keys(CONCIERGE_TRIGGER_LABELS) as ConciergeTrigger[]).map((key) => (
                <option key={key} value={key}>
                  {CONCIERGE_TRIGGER_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Delay threshold (hours)</span>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={thresholdHours}
              onChange={(e) => setThresholdHours(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Authorised action</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value as ConciergeAction)}
            >
              {(Object.keys(CONCIERGE_ACTION_LABELS) as ConciergeAction[]).map((key) => (
                <option key={key} value={key}>
                  {CONCIERGE_ACTION_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Max extra amount</span>
            <div className="flex gap-2">
              <Input value={budgetMajor} onChange={(e) => setBudgetMajor(e.target.value)} />
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24" />
            </div>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating || skip}>
              {creating ? "Saving…" : "Save rule"}
            </Button>
          </div>
        </form>
        {msg ? <p className="mt-3 text-sm text-slate-600">{msg}</p> : null}
      </TravellerSection>

      <TravellerSection title="Your rules">
        {isLoading ? (
          <Spinner />
        ) : !rules?.items?.length ? (
          <p className="text-sm text-slate-500">No rules yet. Create one above to opt in.</p>
        ) : (
          <ul className="space-y-3">
            {rules.items.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{rule.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {CONCIERGE_TRIGGER_LABELS[rule.trigger]}
                      {rule.thresholdMinutes != null ? ` · ≥ ${Math.round(rule.thresholdMinutes / 60)}h` : ""}
                      {" · "}
                      {CONCIERGE_ACTION_LABELS[rule.action]}
                      {" · budget "}
                      {formatConciergeBudget(rule.maxAdditionalMinor, rule.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TravellerChip tone={rule.enabled ? "default" : "muted"}>
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </TravellerChip>
                    {rule.enabled ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await disableRule(rule.id).unwrap();
                            void refetch();
                          } catch (err) {
                            setMsg(formatApiError(err));
                          }
                        }}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await updateRule({ ruleId: rule.id, body: { enabled: true } }).unwrap();
                            void refetch();
                          } catch (err) {
                            setMsg(formatApiError(err));
                          }
                        }}
                      >
                        Enable
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TravellerSection>

      <TravellerSection title="Recent autonomous activity">
        {activityLoading ? (
          <Spinner />
        ) : !activity?.items?.length ? (
          <p className="text-sm text-slate-500">No autonomous actions yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {conciergeStatusLabel(row.status)}
                  {row.reason ? ` · ${row.reason.replace(/_/g, " ").toLowerCase()}` : ""}
                </span>
                <span className="text-slate-500">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TravellerSection>
    </div>
  );
}

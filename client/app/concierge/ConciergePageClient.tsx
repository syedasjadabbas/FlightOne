"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Lock, ShieldOff } from "lucide-react";
import { Button, Spinner, buttonClassName } from "@/components/ui";
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
import { formatApiError } from "@/lib/api/formatApiError";
import { ConciergeSummaryStrip } from "./_components/ConciergeSummaryStrip";
import { ConciergeRuleForm } from "./_components/ConciergeRuleForm";
import { ConciergeRuleList } from "./_components/ConciergeRuleList";
import { ConciergeActivityList } from "./_components/ConciergeActivityList";
import "./concierge.css";

type Tab = "rules" | "activity";
type Flash = { text: string; warn?: boolean };

export function ConciergePageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const {
    data: rules,
    isLoading,
    isError: rulesError,
    refetch,
  } = useListConciergeRulesQuery(undefined, { skip });
  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useListConciergeActivityQuery(undefined, { skip });
  const [createRule, { isLoading: creating }] = useCreateConciergeRuleMutation();
  const [updateRule] = useUpdateConciergeRuleMutation();
  const [disableRule] = useDisableConciergeRuleMutation();
  const [killSwitch, { isLoading: killing }] = useConciergeKillSwitchMutation();
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("rules");
  const [name, setName] = useState("Rebook if delayed over 2 hours");
  const [trigger, setTrigger] = useState<ConciergeTrigger>("DELAY");
  const [thresholdHours, setThresholdHours] = useState("2");
  const [action, setAction] = useState<ConciergeAction>("PREPARE_REBOOK");
  const [budgetMajor, setBudgetMajor] = useState("20000");
  const [currency, setCurrency] = useState("PKR");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const items = rules?.items ?? [];
    return {
      active: items.filter((r) => r.enabled).length,
      paused: items.filter((r) => !r.enabled).length,
      activity: activity?.items?.length ?? 0,
    };
  }, [rules?.items, activity?.items]);

  function showError(err: unknown, fallback: string) {
    setFlash({ text: formatApiError(err, fallback), warn: true });
  }

  function refreshAll() {
    void refetch();
    void refetchActivity();
  }

  if (!hasHydrated) {
    return (
      <div className="fo-concierge__boot" role="status" aria-live="polite">
        <Spinner label="Loading concierge…" />
        <p className="fo-concierge__boot-label">Loading travel concierge</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-concierge__gate">
        <div className="fo-concierge__gate-box">
          <div className="fo-concierge__gate-icon" aria-hidden>
            <Lock size={22} strokeWidth={2} />
          </div>
          <h2 className="fo-concierge__gate-title">Authentication Required</h2>
          <p className="fo-concierge__gate-desc">
            Sign in to manage pre-authorised delay and disruption rules. OTP, payment, and
            corporate approval still gate anything irreversible.
          </p>
          <Link href="/login?redirect=%2Fconcierge" className={buttonClassName({ size: "md" })}>
            Sign In to FlightOne
          </Link>
        </div>
      </div>
    );
  }

  if (rulesError && !rules) {
    return (
      <div className="fo-concierge__gate">
        <div className="fo-concierge__gate-box">
          <div className="fo-concierge__gate-icon fo-concierge__gate-icon--warn" aria-hidden>
            <AlertCircle size={22} strokeWidth={2} />
          </div>
          <h2 className="fo-concierge__gate-title">Concierge Unavailable</h2>
          <p className="fo-concierge__gate-desc">
            Could not load your rules from the secure store.
          </p>
          <Button size="md" variant="secondary" onClick={refreshAll}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFlash(null);
    setBudgetError(null);
    const hours = Number(thresholdHours);
    const major = Number(budgetMajor);
    if (!Number.isFinite(major) || major < 0) {
      setBudgetError("Enter a valid authorised extra budget.");
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
      setFlash({ text: "Rule saved. It only runs on verified disruptions for your bookings." });
      void refetch();
    } catch (err) {
      showError(err, "That request could not be completed. Nothing was booked.");
    }
  }

  return (
    <div className="fo-concierge__master-stage">
      <div className="fo-concierge__nav-rail">
        <span className="fo-concierge__brand-badge">
          <span className="fo-concierge__brand-dot" aria-hidden />
          Concierge
        </span>
        <div className="fo-concierge__tabs" role="tablist" aria-label="Concierge sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={`fo-concierge__tab${tab === "rules" ? " fo-concierge__tab--active" : ""}`}
            onClick={() => setTab("rules")}
          >
            Rules
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            className={`fo-concierge__tab${tab === "activity" ? " fo-concierge__tab--active" : ""}`}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
        </div>
        <div className="fo-concierge__rail-actions">
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={killing || skip}
            icon={<ShieldOff className="h-3.5 w-3.5" aria-hidden />}
            onClick={async () => {
              setFlash(null);
              try {
                const r = await killSwitch().unwrap();
                setFlash({ text: `All rules paused (${r.disabledCount} disabled).` });
                refreshAll();
              } catch (err) {
                showError(err, "That request could not be completed. Nothing was booked.");
              }
            }}
          >
            {killing ? "Pausing…" : "Pause all"}
          </Button>
        </div>
      </div>

      <header className="fo-concierge__hero">
        <h1 className="fo-concierge__title">Travel Concierge</h1>
        <p className="fo-concierge__lede">
          You set the conditions. FlightOne prepares quotes and alerts — never silent tickets,
          payments, cancellations, or refunds.
        </p>
        <ul className="fo-concierge__meta">
          <li>OTP still required</li>
          <li>Payment gates unchanged</li>
          <li>Corporate approval where applicable</li>
        </ul>
      </header>

      {!isLoading && !activityLoading ? (
        <ConciergeSummaryStrip
          activeCount={summary.active}
          pausedCount={summary.paused}
          activityCount={summary.activity}
        />
      ) : null}

      {flash ? (
        <p
          className={`fo-concierge__flash${flash.warn ? " fo-concierge__flash--warn" : ""}`}
          role="status"
        >
          {flash.text}
        </p>
      ) : null}

      {tab === "rules" ? (
        <>
          <ConciergeRuleForm
            name={name}
            trigger={trigger}
            thresholdHours={thresholdHours}
            action={action}
            budgetMajor={budgetMajor}
            currency={currency}
            creating={creating}
            disabled={skip}
            message={null}
            budgetError={budgetError}
            onNameChange={setName}
            onTriggerChange={setTrigger}
            onThresholdChange={setThresholdHours}
            onActionChange={setAction}
            onBudgetChange={(v) => {
              setBudgetError(null);
              setBudgetMajor(v);
            }}
            onCurrencyChange={setCurrency}
            onSubmit={onCreate}
          />

          <ConciergeRuleList
            rules={rules?.items}
            loading={isLoading}
            pendingRuleId={pendingRuleId}
            onDisable={async (ruleId) => {
              setFlash(null);
              setPendingRuleId(ruleId);
              try {
                await disableRule(ruleId).unwrap();
                setFlash({ text: "Rule paused." });
                void refetch();
              } catch (err) {
                showError(err, "That request could not be completed. Nothing was booked.");
              } finally {
                setPendingRuleId(null);
              }
            }}
            onEnable={async (ruleId) => {
              setFlash(null);
              setPendingRuleId(ruleId);
              try {
                await updateRule({ ruleId, body: { enabled: true } }).unwrap();
                setFlash({ text: "Rule enabled." });
                void refetch();
              } catch (err) {
                showError(err, "That request could not be completed. Nothing was booked.");
              } finally {
                setPendingRuleId(null);
              }
            }}
          />
        </>
      ) : activityError && !activity ? (
        <div className="fo-concierge__panel flex flex-col items-start gap-3">
          <p className="m-0 text-sm font-semibold text-navy">Activity unavailable</p>
          <p className="m-0 text-sm text-ink-soft">Could not load recent concierge runs.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetchActivity()}>
            Retry
          </Button>
        </div>
      ) : (
        <ConciergeActivityList items={activity?.items} loading={activityLoading} />
      )}
    </div>
  );
}

"use client";

import { AlertTriangle, LineChart, Loader2, Users } from "lucide-react";
import type { AdvancedAnalyticsDto } from "@/lib/api/corporate.api";
import { StatusBadge } from "./_components/StatusBadge";

export function AdvancedAnalyticsPanel({
  data,
  isLoading,
  isError,
}: {
  data?: AdvancedAnalyticsDto;
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="fo-desk__panel">
        <div className="fo-desk__panel-head">
          <h2 className="fo-desk__section-label">Advanced analytics</h2>
        </div>
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--ink-soft)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--cyan)]" aria-hidden />
          Loading verified observations…
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="fo-desk__panel">
        <div className="fo-desk__panel-head">
          <h2 className="fo-desk__section-label">Advanced analytics</h2>
        </div>
        <div className="fo-dash__empty-box">
          <div className="fo-dash__empty-icon">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-[var(--navy)]">Could not load analytics</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">No fabricated values are shown.</p>
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <div className="fo-desk__panel-head">
        <div>
          <h2 className="fo-desk__section-label">Advanced analytics</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
            Verified FlightOne observations. Forecasts are inferences, not guarantees. Fares and
            supplier contracts are unchanged.
            {data.forecasts.volume.provenance?.generatedAt
              ? ` Generated ${data.forecasts.volume.provenance.generatedAt}.`
              : ""}
            {data.range
              ? ` Period ${data.range.from.slice(0, 10)} → ${data.range.to.slice(0, 10)}.`
              : ""}
          </p>
        </div>
        <LineChart className="h-4 w-4 text-[var(--cyan)]" aria-hidden />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_40%,white)] p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--navy)]">Forecast · volume</p>
            <StatusBadge status={data.forecasts.volume.status} />
          </div>
          <p className="text-xs text-[var(--ink-soft)]">{data.forecasts.volume.explanation}</p>
          {data.forecasts.volume.available ? (
            <p className="mt-2 font-mono text-sm text-[var(--navy)]">
              Next period: {data.forecasts.volume.forecast}
            </p>
          ) : null}
        </div>
        <div className="rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_40%,white)] p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--navy)]">Forecast · spend</p>
            <StatusBadge status={data.forecasts.spend.status} />
          </div>
          <p className="text-xs text-[var(--ink-soft)]">{data.forecasts.spend.explanation}</p>
          {data.forecasts.spend.available ? (
            <p className="mt-2 font-mono text-sm text-[var(--navy)]">
              Next period (minor): {data.forecasts.spend.forecast}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[var(--cyan)]" aria-hidden />
          <p className="text-sm font-semibold text-[var(--navy)]">Cohorts</p>
        </div>
        <p className="text-xs text-[var(--ink-faint)]">{data.cohorts.privacy}</p>
        {!data.cohorts.items.length ? (
          <p className="fo-desk__empty mt-2">{data.cohorts.emptyReason || "No cohort data."}</p>
        ) : (
          <div className="fo-desk__table-wrap mt-2">
            <table className="fo-desk__table">
              <thead>
                <tr>
                  <th>Signup month</th>
                  <th>Size</th>
                  <th>Active</th>
                  <th>Bookings</th>
                  <th>Spend (minor)</th>
                </tr>
              </thead>
              <tbody>
                {data.cohorts.items.map((c) => (
                  <tr key={c.cohort}>
                    <td className="font-mono">{c.cohort}</td>
                    <td className="font-mono">{c.size}</td>
                    <td className="font-mono">{c.activeTravellers}</td>
                    <td className="font-mono">{c.bookings}</td>
                    <td className="font-mono">{c.spendMinor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--navy)]">Pricing association</p>
            <StatusBadge status={data.elasticity.status} />
          </div>
          <p className="text-xs text-[var(--ink-soft)]">{data.elasticity.explanation}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
            Causal: {data.elasticity.causal ? "yes" : "no"} · Auto fare change:{" "}
            {data.elasticity.autoPriceChange ? "yes" : "no"}
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--navy)]">Supplier insights</p>
            <StatusBadge status={data.suppliers.status} />
          </div>
          <p className="text-xs text-[var(--ink-soft)]">{data.suppliers.explanation}</p>
          {data.suppliers.insights?.length ? (
            <ul className="mt-2 space-y-1">
              {data.suppliers.insights.map((i) => (
                <li key={i.kind + (i.supplierCode || "")} className="text-xs text-[var(--ink-soft)]">
                  {i.body}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {data.phase3Activity ? (
        <p className="text-[11px] text-[var(--ink-faint)]">
          Activity in range: voice {data.phase3Activity.voiceSessions}, concierge{" "}
          {data.phase3Activity.conciergeExecutions}, predictive signals{" "}
          {data.phase3Activity.predictiveSignals}
          {data.phase3Activity.expenses != null ? `, expenses ${data.phase3Activity.expenses}` : ""}
          {data.phase3Activity.carbonEstimatesAvailable != null
            ? `, carbon estimates ${data.phase3Activity.carbonEstimatesAvailable}`
            : ""}
          .
        </p>
      ) : null}
    </section>
  );
}

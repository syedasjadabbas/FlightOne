"use client";

import type { AdvancedAnalyticsDto } from "@/lib/api/corporate.api";

function Status({ value }: { value?: string }) {
  return <span className="fo-dash__status-badge fo-dash__status-badge--neutral">{value || "—"}</span>;
}

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
        <h2 className="fo-desk__section-label">Advanced analytics</h2>
        <p className="fo-desk__empty">Loading verified observations…</p>
      </section>
    );
  }
  if (isError) {
    return (
      <section className="fo-desk__panel">
        <h2 className="fo-desk__section-label">Advanced analytics</h2>
        <p className="fo-desk__empty">Could not load analytics. No fabricated values are shown.</p>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <h2 className="fo-desk__section-label">Advanced analytics</h2>
      <p className="text-xs text-slate-600">
        FO_ANALYTICS_V1 over verified FlightOne data. Forecasts are inferences, not guarantees. Fares and
        supplier contracts are not changed.
        {data.forecasts.volume.provenance?.generatedAt
          ? ` Generated ${data.forecasts.volume.provenance.generatedAt}.`
          : ""}
        {data.range ? ` Period ${data.range.from.slice(0, 10)} → ${data.range.to.slice(0, 10)}.` : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Forecasting · volume</p>
          <Status value={data.forecasts.volume.status} />
          <p className="mt-1 text-xs text-slate-600">{data.forecasts.volume.explanation}</p>
          {data.forecasts.volume.available ? (
            <p className="text-sm mt-1">Next-period estimate: {data.forecasts.volume.forecast}</p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Forecasting · spend</p>
          <Status value={data.forecasts.spend.status} />
          <p className="mt-1 text-xs text-slate-600">{data.forecasts.spend.explanation}</p>
          {data.forecasts.spend.available ? (
            <p className="text-sm mt-1">Next-period estimate (minor units): {data.forecasts.spend.forecast}</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Cohorts</p>
        <p className="text-xs text-slate-500">{data.cohorts.privacy}</p>
        {!data.cohorts.items.length ? (
          <p className="fo-desk__empty">{data.cohorts.emptyReason || "No cohort data."}</p>
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
                    <td>{c.cohort}</td>
                    <td>{c.size}</td>
                    <td>{c.activeTravellers}</td>
                    <td>{c.bookings}</td>
                    <td>{c.spendMinor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Pricing association</p>
        <Status value={data.elasticity.status} />
        <p className="mt-1 text-xs text-slate-600">{data.elasticity.explanation}</p>
        <p className="text-[11px] text-slate-500">
          Causal: {data.elasticity.causal ? "yes" : "no"} · Auto fare change:{" "}
          {data.elasticity.autoPriceChange ? "yes" : "no"}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Supplier insights</p>
        <Status value={data.suppliers.status} />
        <p className="mt-1 text-xs text-slate-600">{data.suppliers.explanation}</p>
        {data.suppliers.insights?.length ? (
          <ul className="mt-2 space-y-1">
            {data.suppliers.insights.map((i) => (
              <li key={i.kind + (i.supplierCode || "")} className="text-xs text-slate-700">
                {i.body}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {data.phase3Activity ? (
        <p className="text-[11px] text-slate-500">
          Phase 3 activity in range: voice {data.phase3Activity.voiceSessions}, concierge{" "}
          {data.phase3Activity.conciergeExecutions}, predictive signals {data.phase3Activity.predictiveSignals}
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

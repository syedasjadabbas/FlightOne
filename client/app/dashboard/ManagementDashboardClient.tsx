"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import { useGetDashboardOverviewQuery } from "@/lib/api/dashboard.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";

type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

function rangeFor(key: RangeKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  if (key === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const to = new Date();
  const from = new Date(to);
  if (key === "today") {
    from.setHours(0, 0, 0, 0);
  } else {
    const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
    from.setDate(from.getDate() - days);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function money(minor: number | undefined, currency?: string | null) {
  if (minor == null) return "—";
  const cur = currency || "";
  return `${cur} ${(minor / 100).toFixed(2)}`.trim();
}

function pct(rate: number | null | undefined) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function statusClass(value?: string) {
  if (!value) return "fo-desk__status";
  const u = value.toUpperCase();
  if (u === "OK" || u === "AVAILABLE") return "fo-desk__status fo-desk__status--ok";
  if (u.includes("UNCONFIG") || u.includes("NO_DATA") || u.includes("UNAVAILABLE")) {
    return "fo-desk__status fo-desk__status--warn";
  }
  return "fo-desk__status";
}

export function ManagementDashboardClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { isLoading: permsLoading, hasAny } = usePermissions();
  const canRead = hasAny(["ops:dashboard:read", "dashboard:read"]);

  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const range = useMemo(
    () => rangeFor(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );
  const customInvalid =
    rangeKey === "custom" && (!customFrom || !customTo || new Date(customFrom) > new Date(customTo));

  const { data, isLoading, isFetching, error, refetch } = useGetDashboardOverviewQuery(range, {
    skip: skip || !canRead || customInvalid,
  });

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!accessToken) {
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Sign in required.</p>
      </div>
    );
  }

  return (
    <PermissionGate
      anyOf={["ops:dashboard:read", "dashboard:read"]}
      mode="fallback"
      loading={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
      fallback={
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Management dashboard</h1>
          <p className="fo-desk__lede">
            Missing `ops:dashboard:read` / `dashboard:read` permission.
          </p>
        </header>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Management dashboard</h1>
          <p className="fo-desk__lede">
            Live sales, revenue, and ops health for the selected range. Ops tools stay at{" "}
            <Link href="/ops">/ops</Link>.
          </p>
          <div className="fo-desk__toolbar">
            {(["today", "7d", "30d", "90d", "custom"] as RangeKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRangeKey(k)}
                className={`fo-desk__chip${rangeKey === k ? " fo-desk__chip--active" : ""}`}
              >
                {k === "today" ? "Today" : k === "custom" ? "Custom" : k}
              </button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching || customInvalid}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          {rangeKey === "custom" ? (
            <div className="fo-desk__toolbar text-[13px] text-ink-soft">
              <label className="flex items-center gap-1.5">
                From
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded border border-[var(--fo-desk-line)] bg-white px-2 py-1 text-ink"
                />
              </label>
              <label className="flex items-center gap-1.5">
                To
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded border border-[var(--fo-desk-line)] bg-white px-2 py-1 text-ink"
                />
              </label>
              {customInvalid ? (
                <span className="text-[12px] text-ink-faint">From must be on or before To.</span>
              ) : null}
            </div>
          ) : null}
          {data?.freshness ? (
            <p className="fo-desk__meta">
              Updated {new Date(data.freshness.computedAt).toLocaleString()} · TTL{" "}
              {data.freshness.cacheTtlMs / 1000}s · {data.freshness.strategy}
            </p>
          ) : null}
        </header>

        {error ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">Failed to load dashboard.</p>
          </div>
        ) : null}

        {isLoading || !data ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="fo-desk__kpi-strip" aria-label="Primary KPIs">
              <div className="fo-desk__kpi">
                <p className="fo-desk__kpi-label">Sales</p>
                <p className="fo-desk__kpi-value">{data.sales.recognizedSales}</p>
                <p className="fo-desk__kpi-note">
                  Recognized · created {data.sales.volumeCreated}{" "}
                  <span className={statusClass(data.sales.dataStatus)}>{data.sales.dataStatus}</span>
                </p>
              </div>
              <div className="fo-desk__kpi">
                <p className="fo-desk__kpi-label">Revenue</p>
                <p className="fo-desk__kpi-value">
                  {data.revenue.mixed
                    ? `${(data.revenue.byCurrency || []).length} currencies`
                    : money(data.revenue.revenueMinor, data.revenue.currency)}
                </p>
                <p className="fo-desk__kpi-note">
                  {data.revenue.mixed
                    ? data.revenue.note
                    : `${data.revenue.bookingCount ?? 0} bookings`}{" "}
                  <span className={statusClass(data.revenue.dataStatus)}>{data.revenue.dataStatus}</span>
                </p>
              </div>
              <div className="fo-desk__kpi">
                <p className="fo-desk__kpi-label">Margin</p>
                <p className="fo-desk__kpi-value">
                  {data.margins.mixed
                    ? "Mixed"
                    : money(data.margins.marginMinor, data.margins.currency)}
                </p>
                <p className="fo-desk__kpi-note">
                  {data.margins.mixed
                    ? data.margins.note
                    : `Rate ${pct(data.margins.marginRate ?? null)}`}{" "}
                  <span className={statusClass(String(data.margins.dataStatus || ""))}>
                    {String(data.margins.dataStatus || "")}
                  </span>
                </p>
              </div>
              <div className="fo-desk__kpi">
                <p className="fo-desk__kpi-label">Quote → ticket</p>
                <p className="fo-desk__kpi-value">
                  {pct(data.bookingConversion.conversion.quotedToTicketed)}
                </p>
                <p className="fo-desk__kpi-note">
                  Search→quote {pct(data.bookingConversion.conversion.searchToQuote)} · ticketed{" "}
                  {data.bookingConversion.funnel.reachedTicketed}
                </p>
              </div>
            </div>

            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                <h2 className="fo-desk__section-label">Conversion & automation</h2>
              </div>
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Funnel</td>
                      <td>
                        {data.bookingConversion.funnel.searches} →{" "}
                        {data.bookingConversion.funnel.quoted} →{" "}
                        {data.bookingConversion.funnel.reachedTicketed}
                      </td>
                      <td>
                        <span className={statusClass(data.bookingConversion.dataStatus)}>
                          {data.bookingConversion.dataStatus}
                        </span>{" "}
                        · {data.bookingConversion.searchInstrumentation}
                      </td>
                    </tr>
                    <tr>
                      <td>Automated concierge</td>
                      <td>{pct(data.aiAutomation.automationRate)}</td>
                      <td>
                        {data.aiAutomation.conversationsTotal} conversations ·{" "}
                        {data.aiAutomation.escalatedConversations} escalated ·{" "}
                        <span className={statusClass(data.aiAutomation.dataStatus)}>
                          {data.aiAutomation.dataStatus}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Customers</td>
                      <td>{data.customerAnalytics.bookersInRange} bookers</td>
                      <td>
                        {data.customerAnalytics.usersTotal} users ·{" "}
                        {data.customerAnalytics.repeatBookersInRange} repeat ·{" "}
                        <span className={statusClass(data.customerAnalytics.dataStatus)}>
                          {data.customerAnalytics.dataStatus}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {data.revenue.mixed || data.margins.mixed ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                  <h2 className="fo-desk__section-label">By currency</h2>
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Revenue</th>
                        <th>Margin</th>
                        <th>Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.revenue.byCurrency || []).map((c) => {
                        const m = (data.margins.byCurrency || []).find((x) => x.currency === c.currency);
                        return (
                          <tr key={c.currency}>
                            <td>{c.currency}</td>
                            <td>{money(c.revenueMinor, c.currency)}</td>
                            <td>
                              {m
                                ? `${money(m.marginMinor, m.currency)} (${pct(
                                    m.revenueMinor > 0 ? m.marginMinor / m.revenueMinor : null,
                                  )})`
                                : "—"}
                            </td>
                            <td>{c.bookingCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                <h2 className="fo-desk__section-label">Outstanding credit</h2>
                <span
                  className={statusClass(
                    data.outstandingCredit.dataStatus ||
                      (data.outstandingCredit.available ? "OK" : "UNCONFIGURED"),
                  )}
                >
                  {data.outstandingCredit.dataStatus ||
                    (data.outstandingCredit.available ? "OK" : "UNCONFIGURED")}
                </span>
              </div>
              {!data.outstandingCredit.available ? (
                <p className="fo-desk__empty">Corporate credit unconfigured / unavailable.</p>
              ) : !data.outstandingCredit.companies.length ? (
                <p className="fo-desk__empty">No companies.</p>
              ) : (
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Used</th>
                        <th>Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outstandingCredit.companies.slice(0, 12).map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{money(c.creditUsedMinor, c.currency)}</td>
                          <td>{money(c.creditLimitMinor, c.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                <h2 className="fo-desk__section-label">Supplier performance</h2>
                <span className={statusClass(data.supplierPerformance.dataStatus)}>
                  {data.supplierPerformance.dataStatus}
                </span>
              </div>
              {!data.supplierPerformance.suppliers.length ? (
                <p className="fo-desk__empty">No supplier data in range.</p>
              ) : (
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Bookings</th>
                        <th>Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.supplierPerformance.suppliers.slice(0, 10).map((s) => (
                        <tr key={s.supplierCode}>
                          <td>{s.supplierCode}</td>
                          <td>{s.bookings}</td>
                          <td>{pct(s.fulfillmentRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {(data.customerAnalytics.averageOrderValueByCurrency || []).length ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                  <h2 className="fo-desk__section-label">Average order value</h2>
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>AOV</th>
                        <th>Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.customerAnalytics.averageOrderValueByCurrency || []).map((a) => (
                        <tr key={a.currency}>
                          <td>{a.currency}</td>
                          <td>{money(a.avgAmountMinor, a.currency)}</td>
                          <td>{a.bookingCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="fo-desk__panel fo-desk__panel--flush">
              <div className="fo-desk__panel-head" style={{ padding: "0.75rem 1rem 0" }}>
                <h2 className="fo-desk__section-label">Operational attention</h2>
                <Link href="/ops" className="text-[12px] text-[var(--cyan)] underline">
                  Open ops
                </Link>
              </div>
              <div className="fo-desk__table-wrap">
                <table className="fo-desk__table">
                  <thead>
                    <tr>
                      <th>Queue</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Open escalations</td>
                      <td>{data.operationalKpis.openEscalations}</td>
                    </tr>
                    <tr>
                      <td>Pending refunds</td>
                      <td>{data.operationalKpis.pendingRefunds}</td>
                    </tr>
                    <tr>
                      <td>Recon needs attention</td>
                      <td>{data.operationalKpis.reconciliationNeedsAttention}</td>
                    </tr>
                    <tr>
                      <td>Recon mismatches</td>
                      <td>{data.operationalKpis.reconciliationMismatches}</td>
                    </tr>
                    <tr>
                      <td>Ops outbox pending / failed</td>
                      <td>
                        {data.operationalKpis.opsOutboxPending} / {data.operationalKpis.opsOutboxFailed}
                      </td>
                    </tr>
                    <tr>
                      <td>Active journeys</td>
                      <td>{data.operationalKpis.activeJourneyWatches}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </PermissionGate>
  );
}

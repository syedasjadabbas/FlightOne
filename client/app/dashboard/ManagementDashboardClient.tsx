"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Filter,
  Lock,
  Percent,
  RefreshCw,
  Server,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useGetAdvancedAnalyticsQuery,
  useGetDashboardOverviewQuery,
} from "@/lib/api/dashboard.api";
import { AdvancedAnalyticsPanel } from "./AdvancedAnalyticsPanel";
import { StatusBadge } from "./_components/StatusBadge";
import { clampPct, money, pct, rangeFor, type RangeKey } from "./_components/dashFormat";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";

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
    rangeKey === "custom" &&
    (!customFrom || !customTo || new Date(customFrom) > new Date(customTo));

  const { data, isLoading, isFetching, error, refetch } = useGetDashboardOverviewQuery(range, {
    skip: skip || !canRead || customInvalid,
  });
  const {
    data: advanced,
    isLoading: advancedLoading,
    isError: advancedError,
  } = useGetAdvancedAnalyticsQuery(range, {
    skip: skip || !canRead || customInvalid,
  });

  const creditAggregates = useMemo(() => {
    if (!data?.outstandingCredit?.companies?.length) return null;
    const comps = data.outstandingCredit.companies;
    const totalLimit = comps.reduce((acc, c) => acc + (c.creditLimitMinor || 0), 0);
    const totalUsed = comps.reduce((acc, c) => acc + (c.creditUsedMinor || 0), 0);
    const totalRemaining = totalLimit - totalUsed;
    const overallUtil = totalLimit > 0 ? totalUsed / totalLimit : 0;
    const highRiskComps = comps.filter(
      (c) => c.creditLimitMinor > 0 && c.creditUsedMinor / c.creditLimitMinor > 0.85,
    ).length;
    const primaryCurrency = comps[0]?.currency || "PKR";

    return {
      totalLimit,
      totalUsed,
      totalRemaining,
      overallUtil,
      highRiskComps,
      count: comps.length,
      primaryCurrency,
    };
  }, [data?.outstandingCredit?.companies]);

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner size="md" />
        <p className="text-xs font-medium text-[var(--ink-faint)]">Loading dashboard…</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-desk__panel flex flex-col items-center justify-center py-12 text-center">
        <div className="fo-dash__empty-icon mb-3">
          <Lock className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="text-base font-bold text-[var(--navy)]">Sign in required</h2>
        <p className="mt-1 mb-4 max-w-sm text-sm text-[var(--ink-soft)]">
          Sign in with a management account to view booking volume, revenue, and ops health.
        </p>
        <Link href="/login" className="fo-site-nav__signup">
          Sign in
        </Link>
      </div>
    );
  }

  const salesRecognition =
    data && data.sales.volumeCreated > 0
      ? clampPct((data.sales.recognizedSales / data.sales.volumeCreated) * 100)
      : 0;

  return (
    <PermissionGate
      anyOf={["ops:dashboard:read", "dashboard:read"]}
      mode="fallback"
      loading={
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Spinner size="md" />
          <p className="text-xs font-medium text-[var(--ink-faint)]">Checking permissions…</p>
        </div>
      }
      fallback={
        <div className="fo-desk__panel flex flex-col items-center justify-center py-12 text-center">
          <div className="fo-dash__empty-icon mb-3 border-[color-mix(in_oklab,var(--electric)_30%,var(--fo-desk-line))] text-[var(--electric)]">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-base font-bold text-[var(--navy)]">Access restricted</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--ink-soft)]">
            Your account needs{" "}
            <code className="rounded bg-[color-mix(in_oklab,var(--bone)_60%,white)] px-1 py-0.5 font-mono text-xs">
              ops:dashboard:read
            </code>{" "}
            or{" "}
            <code className="rounded bg-[color-mix(in_oklab,var(--bone)_60%,white)] px-1 py-0.5 font-mono text-xs">
              dashboard:read
            </code>
            .
          </p>
          <p className="mt-2 text-xs text-[var(--ink-faint)]">
            Ask a FlightOne admin for reporting access.
          </p>
        </div>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="fo-dash__tag">Management</span>
                {data?.freshness ? (
                  <div className="fo-dash__live">
                    <span className="fo-dash__pulse-dot" aria-hidden />
                    <span className="font-medium text-[var(--navy)]">Live</span>
                    <span className="text-[var(--ink-faint)]">·</span>
                    <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                      {new Date(data.freshness.computedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
              <h1 className="fo-desk__title">Management dashboard</h1>
              <p className="fo-desk__lede mt-1">
                Booking volume, multi-currency revenue, conversion, and supplier fulfillment.
                Day-to-day queues live on{" "}
                <Link href="/ops" className="inline-flex items-center gap-0.5 font-semibold">
                  /ops
                  <ArrowRight className="inline h-3 w-3" aria-hidden />
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:items-end">
              <div className="fo-dash__range" role="group" aria-label="Date range">
                {(["today", "7d", "30d", "90d", "custom"] as RangeKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRangeKey(k)}
                    className={`fo-dash__pill-btn ${rangeKey === k ? "fo-dash__pill-btn--active" : ""}`}
                  >
                    {k === "today" ? "Today" : k === "custom" ? "Custom" : k}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => refetch()}
                  disabled={isFetching || customInvalid}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  {isFetching ? "Refreshing…" : "Refresh"}
                </Button>
                <Link
                  href="/ops"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--fo-desk-line)] bg-[var(--white)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition-colors hover:bg-[color-mix(in_oklab,var(--bone)_50%,white)]"
                >
                  Ops console
                  <ArrowRight className="h-3 w-3 text-[var(--cyan)]" aria-hidden />
                </Link>
              </div>
            </div>
          </div>

          {rangeKey === "custom" ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[var(--fo-desk-line)] pt-3 text-xs text-[var(--ink-soft)]">
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--navy)]">From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-[var(--fo-desk-line)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--navy)]">To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-[var(--fo-desk-line)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] focus:border-[var(--cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
                />
              </label>
              {customInvalid ? (
                <span className="text-xs font-semibold text-[var(--danger)]">
                  Start date must precede or equal end date.
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="flex items-center justify-between rounded-[var(--fo-desk-radius)] border border-[color-mix(in_oklab,var(--danger)_35%,var(--fo-desk-line))] bg-[color-mix(in_oklab,var(--danger)_6%,white)] p-4 text-[var(--navy)]">
            <div>
              <p className="text-sm font-bold">Failed to load dashboard</p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                Check connectivity or server logs, then retry.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refetch()}
              className="text-xs font-semibold"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {isLoading || !data ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="fo-dash__grid-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex h-32 animate-pulse flex-col justify-between rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-white p-4"
                >
                  <div className="h-3 w-1/3 rounded bg-[color-mix(in_oklab,var(--navy)_8%,transparent)]" />
                  <div className="my-2 h-7 w-1/2 rounded bg-[color-mix(in_oklab,var(--navy)_10%,transparent)]" />
                  <div className="h-2.5 w-3/4 rounded bg-[color-mix(in_oklab,var(--navy)_6%,transparent)]" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="h-56 animate-pulse rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-white" />
              <div className="h-56 animate-pulse rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-white" />
            </div>
          </div>
        ) : (
          <>
            <section aria-label="Headline KPIs" className="fo-dash__grid-4">
              <div className="fo-dash__kpi-card">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Gross sales (GBV)
                    </span>
                    <div className="fo-dash__kpi-icon">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {data.sales.recognizedSales.toLocaleString()}
                  </div>
                  <div className="mt-1 flex items-center justify-between pl-[0.35rem] text-[11.5px] text-[var(--ink-soft)]">
                    <span>Recognized bookings</span>
                    <StatusBadge status={data.sales.dataStatus} />
                  </div>
                </div>
                <div className="fo-dash__kpi-foot">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Recognition rate</span>
                    <span className="font-mono font-semibold text-[var(--navy)]">
                      {salesRecognition}%
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div className="fo-dash__progress-fill" style={{ width: `${salesRecognition}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--ink-faint)]">
                    {data.sales.volumeCreated.toLocaleString()} created in range
                  </p>
                </div>
              </div>

              <div className="fo-dash__kpi-card fo-dash__kpi-card--electric">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Recognized revenue
                    </span>
                    <div className="fo-dash__kpi-icon text-[var(--electric)] border-[color-mix(in_oklab,var(--electric)_22%,transparent)] bg-[color-mix(in_oklab,var(--electric)_8%,white)]">
                      <Wallet className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {data.revenue.mixed
                      ? `${(data.revenue.byCurrency || []).length} currencies`
                      : money(data.revenue.revenueMinor, data.revenue.currency)}
                  </div>
                  <div className="mt-1 flex items-center justify-between pl-[0.35rem] text-[11.5px] text-[var(--ink-soft)]">
                    <span>
                      {data.revenue.mixed
                        ? "Multi-currency ledger"
                        : `${data.revenue.bookingCount ?? 0} orders`}
                    </span>
                    <StatusBadge status={data.revenue.dataStatus} />
                  </div>
                </div>
                <div className="fo-dash__kpi-foot">
                  <p className="truncate text-[10.5px] text-[var(--ink-soft)]">
                    {data.revenue.mixed
                      ? data.revenue.note || "Segregated per currency below"
                      : "Net of cancellations & refunds"}
                  </p>
                </div>
              </div>

              <div className="fo-dash__kpi-card fo-dash__kpi-card--bone">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Operating margin
                    </span>
                    <div className="fo-dash__kpi-icon">
                      <Percent className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {data.margins.mixed ? "Multi-currency" : pct(data.margins.marginRate)}
                  </div>
                  <div className="mt-1 flex items-center justify-between pl-[0.35rem] text-[11.5px] text-[var(--ink-soft)]">
                    <span>
                      {data.margins.mixed
                        ? "Segregated rates"
                        : money(data.margins.marginMinor, data.margins.currency)}
                    </span>
                    <StatusBadge status={data.margins.dataStatus} />
                  </div>
                </div>
                <div className="fo-dash__kpi-foot">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Margin rate</span>
                    <span className="font-mono font-semibold text-[var(--navy)]">
                      {pct(data.margins.marginRate)}
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div
                      className="fo-dash__progress-fill"
                      style={{
                        width: `${Math.min(100, Math.max(8, (data.margins.marginRate || 0) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="fo-dash__kpi-card">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Quote → ticket
                    </span>
                    <div className="fo-dash__kpi-icon">
                      <Filter className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {pct(data.bookingConversion.conversion.quotedToTicketed)}
                  </div>
                  <div className="mt-1 flex items-center justify-between pl-[0.35rem] text-[11.5px] text-[var(--ink-soft)]">
                    <span>
                      Search → quote: {pct(data.bookingConversion.conversion.searchToQuote)}
                    </span>
                    <StatusBadge status={data.bookingConversion.dataStatus} />
                  </div>
                </div>
                <div className="fo-dash__kpi-foot">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Ticketed</span>
                    <span className="font-mono font-semibold text-[var(--navy)]">
                      {data.bookingConversion.funnel.reachedTicketed}
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div
                      className="fo-dash__progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(8, (data.bookingConversion.conversion.quotedToTicketed || 0) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--ink-faint)]">
                    From {data.bookingConversion.funnel.quoted.toLocaleString()} quotes
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="fo-desk__panel flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head">
                    <div>
                      <h2 className="fo-desk__section-label">Booking conversion funnel</h2>
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                        Search → quote → reserved → ticketed
                      </p>
                    </div>
                    <StatusBadge status={data.bookingConversion.dataStatus} />
                  </div>

                  <div className="fo-dash__funnel-grid mt-4">
                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">1</span>
                        <span className="rounded bg-[color-mix(in_oklab,var(--navy)_6%,white)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-soft)]">
                          Base
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Searches
                        </p>
                        <p className="font-mono text-2xl font-bold text-[var(--navy)]">
                          {data.bookingConversion.funnel.searches.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div className="fo-dash__progress-fill" style={{ width: "100%" }} />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--ink-faint)]">100%</p>
                      </div>
                    </div>

                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">2</span>
                        <span className="rounded bg-[var(--fo-desk-wash)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cyan)]">
                          {pct(data.bookingConversion.conversion.searchToQuote)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Quoted
                        </p>
                        <p className="font-mono text-2xl font-bold text-[var(--navy)]">
                          {data.bookingConversion.funnel.quoted.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              width: `${
                                data.bookingConversion.funnel.searches > 0
                                  ? clampPct(
                                      (data.bookingConversion.funnel.quoted /
                                        data.bookingConversion.funnel.searches) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--ink-faint)]">
                          Search → quote
                        </p>
                      </div>
                    </div>

                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">3</span>
                        <span className="rounded bg-[var(--fo-desk-wash)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--cyan)]">
                          {pct(data.bookingConversion.conversion.quotedToReserved)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Reserved
                        </p>
                        <p className="font-mono text-2xl font-bold text-[var(--navy)]">
                          {data.bookingConversion.funnel.reachedReserved.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              width: `${
                                data.bookingConversion.funnel.quoted > 0
                                  ? clampPct(
                                      (data.bookingConversion.funnel.reachedReserved /
                                        data.bookingConversion.funnel.quoted) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--ink-faint)]">
                          Quote → reserved
                        </p>
                      </div>
                    </div>

                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">4</span>
                        <span className="rounded bg-[var(--fo-desk-wash)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--navy)]">
                          {pct(data.bookingConversion.conversion.reservedToTicketed)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                          Ticketed
                        </p>
                        <p className="font-mono text-2xl font-bold text-[var(--navy)]">
                          {data.bookingConversion.funnel.reachedTicketed.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              width: `${
                                data.bookingConversion.funnel.reachedReserved > 0
                                  ? clampPct(
                                      (data.bookingConversion.funnel.reachedTicketed /
                                        data.bookingConversion.funnel.reachedReserved) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--ink-faint)]">
                          Reserved → ticket
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fo-desk-line)] pt-3 text-[11px] text-[var(--ink-faint)]">
                  <span>
                    <span className="font-semibold text-[var(--ink-soft)]">Tracking:</span>{" "}
                    {data.bookingConversion.searchInstrumentation || "Buffered events"}
                  </span>
                  <span className="rounded border border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_45%,white)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--navy)]">
                    Quote → ticket {pct(data.bookingConversion.conversion.quotedToTicketed)}
                  </span>
                </div>
              </section>

              <section className="fo-desk__panel flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head">
                    <div>
                      <h2 className="fo-desk__section-label">Concierge &amp; customers</h2>
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                        Ava automation vs human escalations (target 90%)
                      </p>
                    </div>
                    <StatusBadge status={data.aiAutomation.dataStatus} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col justify-between rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_30%,white)] p-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                            Automation rate
                          </span>
                          <span className="rounded bg-[color-mix(in_oklab,var(--navy)_6%,white)] px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">
                            Target 90%
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-[var(--navy)]">
                          {pct(data.aiAutomation.automationRate)}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--ink-soft)]">
                          {(
                            data.aiAutomation.conversationsTotal -
                            data.aiAutomation.escalatedConversations
                          ).toLocaleString()}{" "}
                          autonomous
                        </div>
                      </div>
                      <div className="mt-4 border-t border-[var(--fo-desk-line)] pt-2">
                        <div className="fo-dash__progress-track">
                          <div
                            className={`fo-dash__progress-fill ${
                              (data.aiAutomation.automationRate || 0) >= 0.9
                                ? ""
                                : "fo-dash__progress-fill--warn"
                            }`}
                            style={{
                              width: `${clampPct((data.aiAutomation.automationRate || 0) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] text-[var(--ink-faint)]">
                          {data.aiAutomation.conversationsTotal.toLocaleString()} conversations ·{" "}
                          {data.aiAutomation.escalatedConversations.toLocaleString()} escalated
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-white p-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                            Retention
                          </span>
                          <StatusBadge status={data.customerAnalytics.dataStatus} />
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-[var(--navy)]">
                          {data.customerAnalytics.bookersInRange.toLocaleString()}
                          <span className="ml-1 font-sans text-xs font-normal text-[var(--ink-soft)]">
                            bookers
                          </span>
                        </div>
                        {data.customerAnalytics.bookersInRange > 0 ? (
                          <div className="mt-1 text-[11px] text-[var(--ink-soft)]">
                            Repeat{" "}
                            <span className="font-mono font-bold text-[var(--cyan)]">
                              {Math.round(
                                (data.customerAnalytics.repeatBookersInRange /
                                  data.customerAnalytics.bookersInRange) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-1 border-t border-[var(--fo-desk-line)] pt-2 text-[11px] text-[var(--ink-soft)]">
                        <div className="flex justify-between">
                          <span>Repeat bookers</span>
                          <span className="font-mono font-semibold text-[var(--navy)]">
                            {data.customerAnalytics.repeatBookersInRange.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Registered users</span>
                          <span className="font-mono font-semibold text-[var(--navy)]">
                            {data.customerAnalytics.usersTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fo-desk-line)] pt-3 text-[11px] text-[var(--ink-faint)]">
                  <span>
                    {data.aiAutomation.formula ||
                      "Unescalated conversations ÷ total conversations"}
                  </span>
                  {data.customerAnalytics.loyaltyTiers?.length ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {data.customerAnalytics.loyaltyTiers.map((t) => (
                        <span
                          key={t.tier}
                          className="rounded bg-[color-mix(in_oklab,var(--navy)_5%,white)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--navy)]"
                        >
                          {t.tier}: {t.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            {data.revenue.mixed ||
            data.margins.mixed ||
            (data.revenue.byCurrency && data.revenue.byCurrency.length > 1) ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head p-4 pb-2">
                  <div>
                    <h2 className="fo-desk__section-label">Multi-currency revenue</h2>
                    <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                      Segregated ledger — no artificial FX conversion
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[var(--ink-faint)]">
                    {data.revenue.byCurrency?.length || 0} currencies
                  </span>
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Gross revenue</th>
                        <th>Operating margin</th>
                        <th>Margin rate</th>
                        <th>Orders</th>
                        <th>Avg basket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.revenue.byCurrency || []).map((c) => {
                        const m = (data.margins.byCurrency || []).find(
                          (x) => x.currency === c.currency,
                        );
                        const rate =
                          m?.marginRate ??
                          (c.revenueMinor > 0 ? (m?.marginMinor || 0) / c.revenueMinor : null);
                        const avgBasket = c.bookingCount > 0 ? c.revenueMinor / c.bookingCount : 0;
                        return (
                          <tr key={c.currency}>
                            <td>
                              <span className="inline-flex rounded-md bg-[color-mix(in_oklab,var(--bone)_55%,white)] px-2 py-0.5 font-mono font-bold text-[var(--navy)]">
                                {c.currency}
                              </span>
                            </td>
                            <td className="font-mono font-semibold text-[var(--navy)]">
                              {money(c.revenueMinor, c.currency)}
                            </td>
                            <td className="font-mono">
                              {m ? money(m.marginMinor, m.currency) : "—"}
                            </td>
                            <td>
                              <span className="inline-flex rounded border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--navy)]">
                                {pct(rate)}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-[var(--ink-soft)]">
                              {c.bookingCount}
                            </td>
                            <td className="font-mono text-xs text-[var(--ink-soft)]">
                              {money(avgBasket, c.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="fo-desk__panel fo-desk__panel--flush flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head p-4 pb-2">
                    <div>
                      <h2 className="fo-desk__section-label">Corporate credit</h2>
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                        Credit lines and utilization
                      </p>
                    </div>
                    <StatusBadge
                      status={
                        data.outstandingCredit.dataStatus ||
                        (data.outstandingCredit.available ? "OK" : "UNCONFIGURED")
                      }
                    />
                  </div>

                  {!data.outstandingCredit.available ? (
                    <div className="p-8">
                      <div className="fo-dash__empty-box">
                        <div className="fo-dash__empty-icon">
                          <Building2 className="h-5 w-5" aria-hidden />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">
                          Credit not configured
                        </h3>
                        <p className="mt-1 mb-3 max-w-sm text-xs text-[var(--ink-soft)]">
                          Corporate billing lines are managed in the Corporate desk.
                        </p>
                        <Link
                          href="/corporate"
                          className="text-xs font-semibold text-[var(--cyan)] hover:underline"
                        >
                          Open Corporate desk →
                        </Link>
                      </div>
                    </div>
                  ) : !data.outstandingCredit.companies.length ? (
                    <div className="p-8">
                      <div className="fo-dash__empty-box">
                        <div className="fo-dash__empty-icon">
                          <Building2 className="h-5 w-5" aria-hidden />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">
                          No active credit accounts
                        </h3>
                        <p className="mt-1 max-w-sm text-xs text-[var(--ink-soft)]">
                          Approved corporate credit facilities will appear here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {creditAggregates ? (
                        <div className="grid grid-cols-2 gap-3 border-b border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_40%,white)] px-4 py-3 sm:grid-cols-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Total limit
                            </span>
                            <div className="mt-0.5 font-mono text-sm font-bold text-[var(--navy)]">
                              {money(creditAggregates.totalLimit, creditAggregates.primaryCurrency)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Outstanding
                            </span>
                            <div className="mt-0.5 font-mono text-sm font-bold text-[var(--navy)]">
                              {money(creditAggregates.totalUsed, creditAggregates.primaryCurrency)}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Utilization
                            </span>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-[var(--navy)]">
                                {pct(creditAggregates.overallUtil)}
                              </span>
                              <div className="fo-dash__progress-track w-14" style={{ marginTop: 0 }}>
                                <div
                                  className={`fo-dash__progress-fill ${
                                    creditAggregates.overallUtil > 0.85
                                      ? "fo-dash__progress-fill--danger"
                                      : creditAggregates.overallUtil > 0.6
                                        ? "fo-dash__progress-fill--warn"
                                        : ""
                                  }`}
                                  style={{
                                    width: `${clampPct(creditAggregates.overallUtil * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between border-b border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--electric)_4%,white)] px-4 py-2 text-[10.5px] text-[var(--ink-soft)]">
                        <span>
                          <strong className="text-[var(--navy)]">Settlement:</strong> 15–30 day
                          cycles
                        </span>
                        {creditAggregates?.highRiskComps ? (
                          <span className="font-semibold text-[var(--danger)]">
                            {creditAggregates.highRiskComps} over 85%
                          </span>
                        ) : null}
                      </div>

                      <div className="fo-desk__table-wrap">
                        <table className="fo-desk__table">
                          <thead>
                            <tr>
                              <th>Company</th>
                              <th>Used</th>
                              <th>Limit</th>
                              <th>Util</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.outstandingCredit.companies.slice(0, 10).map((c) => {
                              const ratio =
                                c.creditLimitMinor > 0
                                  ? c.creditUsedMinor / c.creditLimitMinor
                                  : 0;
                              const utilPct = clampPct(ratio * 100);
                              return (
                                <tr key={c.id}>
                                  <td className="font-semibold text-[var(--navy)]">{c.name}</td>
                                  <td className="font-mono">
                                    {money(c.creditUsedMinor, c.currency)}
                                  </td>
                                  <td className="font-mono text-[var(--ink-soft)]">
                                    {money(c.creditLimitMinor, c.currency)}
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="fo-dash__progress-track w-16"
                                        style={{ marginTop: 0 }}
                                      >
                                        <div
                                          className={`fo-dash__progress-fill ${
                                            utilPct > 85
                                              ? "fo-dash__progress-fill--danger"
                                              : utilPct > 60
                                                ? "fo-dash__progress-fill--warn"
                                                : ""
                                          }`}
                                          style={{ width: `${Math.min(100, utilPct)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] font-medium text-[var(--navy)]">
                                        {utilPct}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--fo-desk-line)] p-3 text-[11px] text-[var(--ink-faint)]">
                  <span>Corporate credit records</span>
                  <Link
                    href="/corporate"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--cyan)] hover:underline"
                  >
                    Corporate desk
                    <ArrowRight className="inline h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </section>

              <section className="fo-desk__panel fo-desk__panel--flush flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head p-4 pb-2">
                    <div>
                      <h2 className="fo-desk__section-label">Supplier fulfillment</h2>
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                        Live booking attempts by supplier
                      </p>
                    </div>
                    <StatusBadge status={data.supplierPerformance.dataStatus} />
                  </div>

                  <div className="flex items-center justify-between border-b border-[var(--fo-desk-line)] bg-[color-mix(in_oklab,var(--bone)_40%,white)] px-4 py-2 text-[10.5px] text-[var(--ink-soft)]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-[var(--cyan)]" aria-hidden />
                      <span>
                        <strong className="text-[var(--navy)]">Gateway SLA:</strong> &lt;15s
                        timeout
                      </span>
                    </div>
                    <span className="hidden text-[var(--ink-faint)] sm:inline">
                      Latency history not persisted
                    </span>
                  </div>

                  {!data.supplierPerformance.suppliers.length ? (
                    <div className="p-8">
                      <div className="fo-dash__empty-box">
                        <div className="fo-dash__empty-icon">
                          <Server className="h-5 w-5" aria-hidden />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">
                          No supplier bookings
                        </h3>
                        <p className="mt-1 max-w-sm text-xs text-[var(--ink-soft)]">
                          Attempts through connected suppliers will populate this table.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="fo-desk__table-wrap">
                      <table className="fo-desk__table">
                        <thead>
                          <tr>
                            <th>Supplier</th>
                            <th>Attempts</th>
                            <th>Confirmed</th>
                            <th>Fulfillment</th>
                            <th>Cancel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.supplierPerformance.suppliers.slice(0, 10).map((s) => {
                            const isHealthy = (s.fulfillmentRate || 0) >= 0.95;
                            const isWarn =
                              (s.fulfillmentRate || 0) < 0.95 && (s.fulfillmentRate || 0) >= 0.8;
                            return (
                              <tr key={s.supplierCode}>
                                <td>
                                  <span className="inline-flex rounded-md bg-[color-mix(in_oklab,var(--bone)_55%,white)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--navy)]">
                                    {s.supplierCode}
                                  </span>
                                </td>
                                <td className="font-mono text-xs">
                                  {s.bookings.toLocaleString()}
                                </td>
                                <td className="font-mono text-xs font-semibold text-[var(--cyan)]">
                                  {s.ticketedOrActive.toLocaleString()}
                                </td>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="fo-dash__progress-track w-16"
                                      style={{ marginTop: 0 }}
                                    >
                                      <div
                                        className={`fo-dash__progress-fill ${
                                          isHealthy
                                            ? ""
                                            : isWarn
                                              ? "fo-dash__progress-fill--warn"
                                              : "fo-dash__progress-fill--danger"
                                        }`}
                                        style={{
                                          width: `${clampPct((s.fulfillmentRate || 0) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="font-mono text-[11px] font-bold text-[var(--navy)]">
                                      {pct(s.fulfillmentRate)}
                                    </span>
                                  </div>
                                </td>
                                <td className="font-mono text-xs text-[var(--ink-soft)]">
                                  {pct(s.cancelRefundRate)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--fo-desk-line)] p-3 text-[11px] text-[var(--ink-faint)]">
                  <span>Reconciliation in ops</span>
                  <Link
                    href="/ops"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--cyan)] hover:underline"
                  >
                    Operations
                    <ArrowRight className="inline h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </section>
            </div>

            {(data.customerAnalytics.averageOrderValueByCurrency || []).length > 0 ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head p-4 pb-2">
                  <div>
                    <h2 className="fo-desk__section-label">Average order value</h2>
                    <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                      Basket size by currency from recognized sales
                    </p>
                  </div>
                  {data.customerAnalytics.loyaltyTiers?.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {data.customerAnalytics.loyaltyTiers.map((t) => (
                        <span
                          key={t.tier}
                          className="rounded-md bg-[color-mix(in_oklab,var(--navy)_5%,white)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--navy)]"
                        >
                          {t.tier}: {t.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>AOV</th>
                        <th>Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customerAnalytics.averageOrderValueByCurrency.map((a) => (
                        <tr key={a.currency}>
                          <td>
                            <span className="inline-flex rounded-md bg-[color-mix(in_oklab,var(--bone)_55%,white)] px-2 py-0.5 font-mono font-bold text-[var(--navy)]">
                              {a.currency}
                            </span>
                          </td>
                          <td className="font-mono font-semibold text-[var(--navy)]">
                            {money(a.avgAmountMinor, a.currency)}
                          </td>
                          <td className="font-mono text-xs text-[var(--ink-soft)]">
                            {a.bookingCount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="fo-desk__panel">
              <div className="fo-desk__panel-head mb-3">
                <div>
                  <h2 className="fo-desk__section-label">Ops queue health</h2>
                  <p className="mt-0.5 text-[11.5px] text-[var(--ink-faint)]">
                    Escalations, refunds, reconciliation, and journey watches
                  </p>
                </div>
                <Link
                  href="/ops"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cyan)] hover:underline"
                >
                  Open ops
                  <ArrowRight className="inline h-3 w-3" aria-hidden />
                </Link>
              </div>

              <div className="fo-dash__queue-grid">
                <div
                  className={`fo-dash__queue-card ${
                    data.operationalKpis.openEscalations > 0
                      ? "fo-dash__queue-card--warn"
                      : "fo-dash__queue-card--nominal"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Open escalations
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.openEscalations}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">
                    {data.operationalKpis.escalationsCreatedInRange} created in range
                  </span>
                </div>

                <div
                  className={`fo-dash__queue-card ${
                    data.operationalKpis.pendingRefunds > 0
                      ? "fo-dash__queue-card--warn"
                      : "fo-dash__queue-card--nominal"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Pending refunds
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.pendingRefunds}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">Awaiting review</span>
                </div>

                <div
                  className={`fo-dash__queue-card ${
                    data.operationalKpis.reconciliationNeedsAttention > 0
                      ? "fo-dash__queue-card--warn"
                      : "fo-dash__queue-card--nominal"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Recon reviews
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.reconciliationNeedsAttention}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">Supplier items</span>
                </div>

                <div
                  className={`fo-dash__queue-card ${
                    data.operationalKpis.reconciliationMismatches > 0
                      ? "fo-dash__queue-card--alert"
                      : "fo-dash__queue-card--nominal"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Recon mismatches
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.reconciliationMismatches}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">Discrepancies</span>
                </div>

                <div
                  className={`fo-dash__queue-card ${
                    data.operationalKpis.opsOutboxFailed > 0
                      ? "fo-dash__queue-card--alert"
                      : "fo-dash__queue-card--nominal"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Outbox failed
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.opsOutboxFailed}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">
                    {data.operationalKpis.opsOutboxPending} pending
                  </span>
                </div>

                <div className="fo-dash__queue-card fo-dash__queue-card--nominal">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Active journeys
                  </span>
                  <div className="fo-dash__queue-count">
                    {data.operationalKpis.activeJourneyWatches}
                  </div>
                  <span className="mt-1 text-[10.5px] text-[var(--ink-soft)]">
                    {data.operationalKpis.journeyEventsInRange} events in range
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
        <AdvancedAnalyticsPanel
          data={advanced}
          isLoading={advancedLoading}
          isError={advancedError}
        />
      </div>
    </PermissionGate>
  );
}

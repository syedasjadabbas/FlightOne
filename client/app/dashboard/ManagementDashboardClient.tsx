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
  return `${cur} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function pct(rate: number | null | undefined) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const u = status.toUpperCase();
  const isOk = u === "OK" || u === "AVAILABLE";
  const isWarn = u.includes("UNCONFIG") || u.includes("NO_DATA") || u.includes("UNAVAILABLE");

  const badgeClass = isOk
    ? "fo-dash__status-badge fo-dash__status-badge--ok"
    : isWarn
    ? "fo-dash__status-badge fo-dash__status-badge--warn"
    : "fo-dash__status-badge fo-dash__status-badge--neutral";

  return (
    <span className={badgeClass}>
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          background: isOk ? "#10b981" : isWarn ? "#f59e0b" : "var(--fo-desk-muted)",
        }}
      />
      <span>{status}</span>
    </span>
  );
}

/* ── Icon helpers ────────────────────────────────────────────────────────── */

function ChartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function VaultIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MarginIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function FunnelIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function RefreshIcon({ className = "h-3.5 w-3.5", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg className={`${className} ${spinning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function BuildingIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function ServerIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

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

  // Calculate aggregate corporate credit totals if available
  const creditAggregates = useMemo(() => {
    if (!data?.outstandingCredit?.companies?.length) return null;
    const comps = data.outstandingCredit.companies;
    const totalLimit = comps.reduce((acc, c) => acc + (c.creditLimitMinor || 0), 0);
    const totalUsed = comps.reduce((acc, c) => acc + (c.creditUsedMinor || 0), 0);
    const totalRemaining = totalLimit - totalUsed;
    const overallUtil = totalLimit > 0 ? totalUsed / totalLimit : 0;
    const highRiskComps = comps.filter((c) => c.creditLimitMinor > 0 && c.creditUsedMinor / c.creditLimitMinor > 0.85).length;
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
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="md" />
        <p className="text-xs text-[var(--ink-faint)] font-medium">Loading FlightOne executive suite…</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-desk__panel flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
          <VaultIcon className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-[var(--navy)]">Authentication Required</h2>
        <p className="text-sm text-[var(--ink-soft)] max-w-sm mt-1 mb-4">
          Please sign in with an executive or management account to view the FlightOne live analytics suite.
        </p>
        <Link href="/login" className="fo-site-nav__signup">
          Sign in to continue
        </Link>
      </div>
    );
  }

  return (
    <PermissionGate
      anyOf={["ops:dashboard:read", "dashboard:read"]}
      mode="fallback"
      loading={
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size="md" />
          <p className="text-xs text-[var(--ink-faint)] font-medium">Validating executive permissions…</p>
        </div>
      }
      fallback={
        <div className="fo-desk__panel flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3 border border-amber-200">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[var(--navy)]">Access Restricted</h2>
          <p className="text-sm text-[var(--ink-soft)] max-w-md mt-1">
            Your account is authenticated but lacks <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">ops:dashboard:read</code> or <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">dashboard:read</code> permission.
          </p>
          <p className="text-xs text-[var(--ink-faint)] mt-2">
            Contact your FlightOne administrator to request executive reporting privileges.
          </p>
        </div>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.5rem" }}>
        {/* ── Executive Header ────────────────────────────────────────────── */}
        <header className="fo-desk__header pb-4 border-b border-[var(--fo-desk-line)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_oklab,var(--cyan)_10%,transparent)] px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider uppercase text-[var(--cyan)] border border-[color-mix(in_oklab,var(--cyan)_25%,transparent)]">
                  Executive Suite · Module 17
                </span>
                {data?.freshness ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[11px] text-[var(--ink-soft)] border border-slate-200/80">
                    <span className="fo-dash__pulse-dot" />
                    <span className="font-medium">Live SWR Cache</span>
                    <span className="text-[var(--ink-faint)]">·</span>
                    <span className="text-[10px] text-[var(--ink-faint)] font-mono">
                      {new Date(data.freshness.computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ) : null}
              </div>
              <h1 className="fo-desk__title">Management Dashboard</h1>
              <p className="fo-desk__lede mt-1">
                Authoritative booking volume, multi-currency revenue, conversion funnels, and supplier fulfillment metrics. Operational execution stays at{" "}
                <Link href="/ops" className="inline-flex items-center gap-0.5 font-semibold text-[var(--cyan)] hover:underline">
                  <span>/ops</span>
                  <ArrowRightIcon className="h-3 w-3 inline" />
                </Link>
              </p>
            </div>

            {/* Time period toolbar & Refresh */}
            <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
              <div className="inline-flex items-center p-1 rounded-xl border border-[var(--fo-desk-line)] bg-[var(--white)] shadow-xs">
                {(["today", "7d", "30d", "90d", "custom"] as RangeKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRangeKey(k)}
                    className={`fo-dash__pill-btn ${rangeKey === k ? "fo-dash__pill-btn--active" : ""}`}
                  >
                    {k === "today" ? "Today" : k === "custom" ? "Custom Range" : k}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => refetch()}
                  disabled={isFetching || customInvalid}
                  className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg shadow-xs"
                >
                  <RefreshIcon spinning={isFetching} />
                  <span>{isFetching ? "Refreshing…" : "Refresh"}</span>
                </Button>
                <Link
                  href="/ops"
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--fo-desk-line)] bg-[var(--white)] text-[var(--navy)] hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <span>Ops Console</span>
                  <ArrowRightIcon className="h-3 w-3 text-[var(--cyan)]" />
                </Link>
              </div>
            </div>
          </div>

          {/* Custom Date Range Selectors */}
          {rangeKey === "custom" ? (
            <div className="flex flex-wrap items-center gap-3 pt-3 mt-2 border-t border-[var(--fo-desk-line)] text-xs text-[var(--ink-soft)]">
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--navy)]">From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-[var(--fo-desk-line)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] shadow-xs focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--navy)]">To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-[var(--fo-desk-line)] bg-white px-3 py-1.5 text-xs text-[var(--navy)] shadow-xs focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] focus:outline-none"
                />
              </label>
              {customInvalid ? (
                <span className="text-rose-600 font-semibold text-xs">
                  Start date must precede or equal end date.
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* ── Error Banner ────────────────────────────────────────────────── */}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 flex items-center justify-between shadow-xs">
            <div>
              <p className="font-bold text-sm">Failed to retrieve dashboard analytics</p>
              <p className="text-xs text-rose-700 mt-0.5">Please check network connectivity or server operations logs.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => refetch()} className="text-xs font-semibold">
              Retry
            </Button>
          </div>
        ) : null}

        {/* ── Loading Skeleton vs Dashboard Content ───────────────────────── */}
        {isLoading || !data ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="fo-dash__grid-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 rounded-xl border border-[var(--fo-desk-line)] bg-white p-5 animate-pulse flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-1/3 bg-slate-200 rounded" />
                    <div className="h-7 w-7 bg-slate-100 rounded-lg" />
                  </div>
                  <div className="h-8 w-1/2 bg-slate-200 rounded my-2" />
                  <div className="h-3 w-3/4 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 rounded-xl border border-[var(--fo-desk-line)] bg-white p-6 animate-pulse" />
              <div className="h-64 rounded-xl border border-[var(--fo-desk-line)] bg-white p-6 animate-pulse" />
            </div>
            <div className="h-44 rounded-xl border border-[var(--fo-desk-line)] bg-white p-6 animate-pulse" />
          </div>
        ) : (
          <>
            {/* ── 1. Primary Executive KPI Cards ────────────────────────────── */}
            <section aria-label="Headline KPIs" className="fo-dash__grid-4">
              {/* Sales Volume */}
              <div className="fo-dash__kpi-card fo-dash__kpi-card--cyan">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Gross Sales (GBV)
                    </span>
                    <div className="fo-dash__kpi-icon">
                      <ChartIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">{data.sales.recognizedSales.toLocaleString()}</div>
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-soft)] mt-1">
                    <span>Recognized Bookings</span>
                    <StatusBadge status={data.sales.dataStatus} />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--fo-desk-line)]">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Recognition Rate</span>
                    <span className="font-mono font-semibold text-[var(--navy)]">
                      {data.sales.volumeCreated > 0
                        ? `${Math.round((data.sales.recognizedSales / data.sales.volumeCreated) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div
                      className="fo-dash__progress-fill"
                      style={{
                        width: `${data.sales.volumeCreated > 0 ? Math.min(100, Math.round((data.sales.recognizedSales / data.sales.volumeCreated) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-1.5">
                    {data.sales.volumeCreated.toLocaleString()} total created in range
                  </p>
                </div>
              </div>

              {/* Revenue */}
              <div className="fo-dash__kpi-card fo-dash__kpi-card--cyan">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Recognized Revenue
                    </span>
                    <div className="fo-dash__kpi-icon" style={{ color: "#007ae5", background: "rgba(0, 122, 229, 0.08)", borderColor: "rgba(0, 122, 229, 0.2)" }}>
                      <VaultIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {data.revenue.mixed
                      ? `${(data.revenue.byCurrency || []).length} Currencies`
                      : money(data.revenue.revenueMinor, data.revenue.currency)}
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-soft)] mt-1">
                    <span>{data.revenue.mixed ? "Multi-Currency Ledger" : `${data.revenue.bookingCount ?? 0} recognized orders`}</span>
                    <StatusBadge status={data.revenue.dataStatus} />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--fo-desk-line)]">
                  <p className="text-[10.5px] text-[var(--ink-soft)] truncate">
                    {data.revenue.mixed
                      ? data.revenue.note || "Segregated per currency below"
                      : "Net of cancellations & refunds (Module 05)"}
                  </p>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-1">
                    Authoritative Module 05 pricing
                  </p>
                </div>
              </div>

              {/* Operating Margin */}
              <div className="fo-dash__kpi-card fo-dash__kpi-card--emerald">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Operating Margin
                    </span>
                    <div className="fo-dash__kpi-icon" style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
                      <MarginIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {data.margins.mixed ? "Multi-Currency" : pct(data.margins.marginRate)}
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-soft)] mt-1">
                    <span>
                      {data.margins.mixed
                        ? "Segregated Rates"
                        : money(data.margins.marginMinor, data.margins.currency)}
                    </span>
                    <StatusBadge status={data.margins.dataStatus} />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--fo-desk-line)]">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Margin Health</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {pct(data.margins.marginRate)}
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div
                      className="fo-dash__progress-fill"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        width: `${Math.min(100, Math.max(8, (data.margins.marginRate || 0) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-1.5">
                    Authoritative Module 05 margin engine
                  </p>
                </div>
              </div>

              {/* Conversion */}
              <div className="fo-dash__kpi-card fo-dash__kpi-card--indigo">
                <div>
                  <div className="fo-dash__kpi-header">
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                      Quote → Ticket
                    </span>
                    <div className="fo-dash__kpi-icon" style={{ color: "#6366f1", background: "rgba(99, 102, 241, 0.08)", borderColor: "rgba(99, 102, 241, 0.2)" }}>
                      <FunnelIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="fo-dash__kpi-value">
                    {pct(data.bookingConversion.conversion.quotedToTicketed)}
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-soft)] mt-1">
                    <span>Search → Quote: {pct(data.bookingConversion.conversion.searchToQuote)}</span>
                    <StatusBadge status={data.bookingConversion.dataStatus} />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--fo-desk-line)]">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-faint)]">
                    <span>Funnel Yield</span>
                    <span className="font-mono font-semibold text-indigo-700">
                      {data.bookingConversion.funnel.reachedTicketed} ticketed
                    </span>
                  </div>
                  <div className="fo-dash__progress-track">
                    <div
                      className="fo-dash__progress-fill"
                      style={{
                        background: "linear-gradient(90deg, #818cf8, #4f46e5)",
                        width: `${Math.min(100, Math.max(8, (data.bookingConversion.conversion.quotedToTicketed || 0) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--ink-faint)] mt-1.5">
                    From {data.bookingConversion.funnel.quoted.toLocaleString()} generated quotes
                  </p>
                </div>
              </div>
            </section>

            {/* ── 2. Conversion Funnel & Concierge Automation ───────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Funnel Pipeline */}
              <section className="fo-desk__panel flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head">
                    <div>
                      <h2 className="fo-desk__section-label">Booking Conversion Funnel</h2>
                      <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                        End-to-end transition lifecycle from initial search to ticketed confirmation
                      </p>
                    </div>
                    <StatusBadge status={data.bookingConversion.dataStatus} />
                  </div>

                  <div className="fo-dash__funnel-grid mt-4">
                    {/* Step 1: Searches */}
                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">1</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Baseline
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Searches</p>
                        <p className="text-2xl font-bold text-[var(--navy)] font-mono">
                          {data.bookingConversion.funnel.searches.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div className="fo-dash__progress-fill" style={{ width: "100%" }} />
                        </div>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-1 font-mono">100% initial pool</p>
                      </div>
                    </div>

                    {/* Step 2: Quoted */}
                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">2</span>
                        <span className="text-[10px] font-bold text-[var(--cyan)] bg-cyan-50 px-1.5 py-0.5 rounded font-mono">
                          {pct(data.bookingConversion.conversion.searchToQuote)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Quoted</p>
                        <p className="text-2xl font-bold text-[var(--navy)] font-mono">
                          {data.bookingConversion.funnel.quoted.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              width: `${data.bookingConversion.funnel.searches > 0 ? Math.min(100, Math.round((data.bookingConversion.funnel.quoted / data.bookingConversion.funnel.searches) * 100)) : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-1 font-mono">Search → Quote</p>
                      </div>
                    </div>

                    {/* Step 3: Reserved */}
                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">3</span>
                        <span className="text-[10px] font-bold text-[var(--cyan)] bg-cyan-50 px-1.5 py-0.5 rounded font-mono">
                          {pct(data.bookingConversion.conversion.quotedToReserved)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Reserved</p>
                        <p className="text-2xl font-bold text-[var(--navy)] font-mono">
                          {data.bookingConversion.funnel.reachedReserved.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              width: `${data.bookingConversion.funnel.quoted > 0 ? Math.min(100, Math.round((data.bookingConversion.funnel.reachedReserved / data.bookingConversion.funnel.quoted) * 100)) : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-1 font-mono">Quote → Reserved</p>
                      </div>
                    </div>

                    {/* Step 4: Ticketed */}
                    <div className="fo-dash__funnel-card">
                      <div className="flex items-center justify-between">
                        <span className="fo-dash__funnel-step-badge">4</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                          {pct(data.bookingConversion.conversion.reservedToTicketed)}
                        </span>
                      </div>
                      <div className="my-2.5">
                        <p className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">Ticketed</p>
                        <p className="text-2xl font-bold text-[var(--navy)] font-mono">
                          {data.bookingConversion.funnel.reachedTicketed.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              background: "linear-gradient(90deg, #10b981, #059669)",
                              width: `${data.bookingConversion.funnel.reachedReserved > 0 ? Math.min(100, Math.round((data.bookingConversion.funnel.reachedTicketed / data.bookingConversion.funnel.reachedReserved) * 100)) : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-1 font-mono">Reserved → Ticket</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-[var(--fo-desk-line)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-faint)]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--ink-soft)]">Tracking:</span>
                    <span>{data.bookingConversion.searchInstrumentation || "Buffered event tracking"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--ink-soft)]">Total Quoted → Ticketed:</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200/60">
                      {pct(data.bookingConversion.conversion.quotedToTicketed)}
                    </span>
                  </div>
                </div>
              </section>

              {/* AI Concierge & Customer Servicing */}
              <section className="fo-desk__panel flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head">
                    <div>
                      <h2 className="fo-desk__section-label">AI Concierge & Customer Servicing</h2>
                      <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                        Ava automated resolution rate vs human support escalations (Target: 90%)
                      </p>
                    </div>
                    <StatusBadge status={data.aiAutomation.dataStatus} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {/* Automation Gauge Card */}
                    <div className="rounded-xl border border-[var(--fo-desk-line)] p-4 bg-white flex flex-col justify-between shadow-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                            AI Automation Rate
                          </span>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            Target: 90%
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-[var(--navy)] font-mono mt-2">
                          {pct(data.aiAutomation.automationRate)}
                        </div>
                        <div className="text-[11px] text-[var(--ink-soft)] mt-1">
                          {(data.aiAutomation.conversationsTotal - data.aiAutomation.escalatedConversations).toLocaleString()} fully autonomous
                        </div>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-100">
                        <div className="fo-dash__progress-track">
                          <div
                            className="fo-dash__progress-fill"
                            style={{
                              background:
                                (data.aiAutomation.automationRate || 0) >= 0.9
                                  ? "linear-gradient(90deg, #10b981, #059669)"
                                  : "linear-gradient(90deg, #f59e0b, #d97706)",
                              width: `${Math.min(100, Math.round((data.aiAutomation.automationRate || 0) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-1.5">
                          {data.aiAutomation.conversationsTotal.toLocaleString()} conversations · {data.aiAutomation.escalatedConversations.toLocaleString()} escalated to human
                        </p>
                      </div>
                    </div>

                    {/* Customer Activity Card */}
                    <div className="rounded-xl border border-[var(--fo-desk-line)] p-4 bg-white flex flex-col justify-between shadow-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                            Customer Retention
                          </span>
                          <StatusBadge status={data.customerAnalytics.dataStatus} />
                        </div>
                        <div className="text-3xl font-bold text-[var(--navy)] font-mono mt-2">
                          {data.customerAnalytics.bookersInRange.toLocaleString()}{" "}
                          <span className="text-xs font-normal text-[var(--ink-soft)] font-sans">active bookers</span>
                        </div>
                        {data.customerAnalytics.bookersInRange > 0 ? (
                          <div className="text-[11px] text-[var(--ink-soft)] mt-1">
                            Repeat rate:{" "}
                            <span className="font-mono font-bold text-[var(--cyan)]">
                              {Math.round((data.customerAnalytics.repeatBookersInRange / data.customerAnalytics.bookersInRange) * 100)}%
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 pt-2 border-t border-slate-100 text-[11px] text-[var(--ink-soft)]">
                        <div className="flex items-center justify-between mb-1">
                          <span>Repeat bookers:</span>
                          <span className="font-semibold text-[var(--navy)] font-mono">
                            {data.customerAnalytics.repeatBookersInRange.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total users registered:</span>
                          <span className="font-semibold text-[var(--navy)] font-mono">
                            {data.customerAnalytics.usersTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-[var(--fo-desk-line)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-faint)]">
                  <span>Formula: {data.aiAutomation.formula || "Unescalated conversations ÷ Total conversations"}</span>
                  {data.customerAnalytics.loyaltyTiers && data.customerAnalytics.loyaltyTiers.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {data.customerAnalytics.loyaltyTiers.map((t) => (
                        <span key={t.tier} className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                          {t.tier}: {t.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            {/* ── 3. Multi-Currency Financial Breakdown (if applicable) ─────── */}
            {data.revenue.mixed || data.margins.mixed || (data.revenue.byCurrency && data.revenue.byCurrency.length > 1) ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head p-4 pb-2">
                  <div>
                    <h2 className="fo-desk__section-label">Multi-Currency Revenue & Margins</h2>
                    <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                      Segregated multi-currency ledger without artificial FX conversions (Module 05)
                    </p>
                  </div>
                  <span className="text-xs text-[var(--ink-faint)] font-mono">
                    {data.revenue.byCurrency?.length || 0} currencies active
                  </span>
                </div>
                <div className="fo-desk__table-wrap">
                  <table className="fo-desk__table">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Gross Revenue</th>
                        <th>Operating Margin</th>
                        <th>Margin Rate</th>
                        <th>Orders</th>
                        <th>Avg Basket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.revenue.byCurrency || []).map((c) => {
                        const m = (data.margins.byCurrency || []).find((x) => x.currency === c.currency);
                        const rate = m?.marginRate ?? (c.revenueMinor > 0 ? (m?.marginMinor || 0) / c.revenueMinor : null);
                        const avgBasket = c.bookingCount > 0 ? c.revenueMinor / c.bookingCount : 0;
                        return (
                          <tr key={c.currency} className="hover:bg-slate-50/70 transition-colors">
                            <td className="font-bold text-[var(--navy)] font-mono">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-bold">
                                {c.currency}
                              </span>
                            </td>
                            <td className="font-semibold text-[var(--navy)] font-mono">{money(c.revenueMinor, c.currency)}</td>
                            <td className="font-mono">{m ? money(m.marginMinor, m.currency) : "—"}</td>
                            <td>
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-mono border border-emerald-200/50">
                                {pct(rate)}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-[var(--ink-soft)]">{c.bookingCount}</td>
                            <td className="font-mono text-xs text-[var(--ink-soft)]">{money(avgBasket, c.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* ── 4. Corporate Credit & Supplier Ecosystem ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Corporate Credit (Aligned with SDS DB-01 Wireframe) */}
              <section className="fo-desk__panel fo-desk__panel--flush flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head p-4 pb-2">
                    <div>
                      <h2 className="fo-desk__section-label">Corporate Credit & Receivables</h2>
                      <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                        Credit lines, authorized balances, and utilization limits (Module 06)
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
                          <BuildingIcon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">Corporate Credit Unconfigured</h3>
                        <p className="text-xs text-[var(--ink-soft)] max-w-sm mt-1 mb-3">
                          Corporate credit module is not initialized for this environment. Corporate billing lines and net invoicing terms are managed in the Corporate Desk.
                        </p>
                        <Link href="/corporate" className="text-xs font-semibold text-[var(--cyan)] hover:underline">
                          Open Corporate Desk →
                        </Link>
                      </div>
                    </div>
                  ) : !data.outstandingCredit.companies.length ? (
                    <div className="p-8">
                      <div className="fo-dash__empty-box">
                        <div className="fo-dash__empty-icon">
                          <BuildingIcon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">No Active Corporate Accounts</h3>
                        <p className="text-xs text-[var(--ink-soft)] max-w-sm mt-1">
                          No corporate companies with approved credit facilities found. Credit accounts will appear here once approved.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Aggregate Credit Summary Bar */}
                      {creditAggregates ? (
                        <div className="px-4 py-3 bg-slate-50/70 border-b border-[var(--fo-desk-line)] grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Total Limit
                            </span>
                            <div className="text-sm font-bold text-[var(--navy)] font-mono mt-0.5">
                              {money(creditAggregates.totalLimit, creditAggregates.primaryCurrency)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Outstanding Used
                            </span>
                            <div className="text-sm font-bold text-[var(--navy)] font-mono mt-0.5">
                              {money(creditAggregates.totalUsed, creditAggregates.primaryCurrency)}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                              Portfolio Utilization
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-bold text-[var(--navy)] font-mono">
                                {pct(creditAggregates.overallUtil)}
                              </span>
                              <div className="w-14 fo-dash__progress-track" style={{ marginTop: 0 }}>
                                <div
                                  className="fo-dash__progress-fill"
                                  style={{
                                    width: `${Math.min(100, Math.round(creditAggregates.overallUtil * 100))}%`,
                                    background:
                                      creditAggregates.overallUtil > 0.85
                                        ? "#ef4444"
                                        : creditAggregates.overallUtil > 0.6
                                        ? "#f59e0b"
                                        : "#0896bf",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Invoicing Terms Notice (SDS DB-01 Ageing Reference) */}
                      <div className="px-4 py-2 bg-amber-50/40 border-b border-[var(--fo-desk-line)] flex items-center justify-between text-[10.5px] text-[var(--ink-soft)]">
                        <span>
                          <strong className="text-[var(--navy)]">Settlement Policy:</strong> 15–30 day invoicing cycles (Current 0–15d · Due 16–30d · Aged 31–60d · Delinquent 60+d)
                        </span>
                        {creditAggregates?.highRiskComps ? (
                          <span className="text-rose-700 font-semibold">
                            {creditAggregates.highRiskComps} account(s) &gt; 85% cap
                          </span>
                        ) : null}
                      </div>

                      <div className="fo-desk__table-wrap">
                        <table className="fo-desk__table">
                          <thead>
                            <tr>
                              <th>Company</th>
                              <th>Used Balance</th>
                              <th>Credit Limit</th>
                              <th>Utilization</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.outstandingCredit.companies.slice(0, 10).map((c) => {
                              const ratio = c.creditLimitMinor > 0 ? c.creditUsedMinor / c.creditLimitMinor : 0;
                              const utilPct = Math.round(ratio * 100);
                              const barColor =
                                utilPct > 85 ? "#ef4444" : utilPct > 60 ? "#f59e0b" : "#0896bf";
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="font-semibold text-[var(--navy)]">{c.name}</td>
                                  <td className="font-mono">{money(c.creditUsedMinor, c.currency)}</td>
                                  <td className="text-[var(--ink-soft)] font-mono">{money(c.creditLimitMinor, c.currency)}</td>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 fo-dash__progress-track" style={{ marginTop: 0 }}>
                                        <div
                                          className="fo-dash__progress-fill"
                                          style={{ width: `${Math.min(100, utilPct)}%`, background: barColor }}
                                        />
                                      </div>
                                      <span className="text-[11px] font-mono font-medium text-[var(--navy)]">
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

                <div className="p-3 border-t border-[var(--fo-desk-line)] flex items-center justify-between text-[11px] text-[var(--ink-faint)]">
                  <span>Authoritative Module 06 corporate records</span>
                  <Link href="/corporate" className="text-[var(--cyan)] hover:underline font-semibold inline-flex items-center gap-1">
                    <span>Corporate Desk</span>
                    <ArrowRightIcon className="h-3 w-3 inline" />
                  </Link>
                </div>
              </section>

              {/* Supplier Performance & Fulfillment (SDS DB-01 alignment & Requirement 12) */}
              <section className="fo-desk__panel fo-desk__panel--flush flex flex-col justify-between">
                <div>
                  <div className="fo-desk__panel-head p-4 pb-2">
                    <div>
                      <h2 className="fo-desk__section-label">Supplier Performance & Fulfillment</h2>
                      <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                        Authoritative fulfillment tracking from live supplier booking attempts
                      </p>
                    </div>
                    <StatusBadge status={data.supplierPerformance.dataStatus} />
                  </div>

                  {/* Surface supplier latency notice honestly without inventing backend metric */}
                  <div className="px-4 py-2 bg-slate-50/70 border-b border-[var(--fo-desk-line)] flex items-center justify-between text-[10.5px] text-[var(--ink-soft)]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        <strong className="text-[var(--navy)]">Gateway SLA:</strong> Real-time edge monitored (&lt;15s timeout SLA per SDS §3.2)
                      </span>
                    </div>
                    <span className="text-[var(--ink-faint)] hidden sm:inline">Historical latency not persisted</span>
                  </div>

                  {!data.supplierPerformance.suppliers.length ? (
                    <div className="p-8">
                      <div className="fo-dash__empty-box">
                        <div className="fo-dash__empty-icon">
                          <ServerIcon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--navy)]">No Supplier Bookings Recorded</h3>
                        <p className="text-xs text-[var(--ink-soft)] max-w-sm mt-1">
                          No supplier transaction data recorded in the selected period. Booking attempts through Galileo or RateHawk will populate here.
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
                            <th>Fulfillment Rate</th>
                            <th>Cancellation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.supplierPerformance.suppliers.slice(0, 10).map((s) => {
                            const isHealthy = (s.fulfillmentRate || 0) >= 0.95;
                            const isWarn = (s.fulfillmentRate || 0) < 0.95 && (s.fulfillmentRate || 0) >= 0.8;
                            return (
                              <tr key={s.supplierCode} className="hover:bg-slate-50/70 transition-colors">
                                <td>
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-bold font-mono text-xs text-[var(--navy)]">
                                    {s.supplierCode}
                                  </span>
                                </td>
                                <td className="font-mono text-xs">{s.bookings.toLocaleString()}</td>
                                <td className="font-mono text-xs text-emerald-700 font-semibold">{s.ticketedOrActive.toLocaleString()}</td>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 fo-dash__progress-track" style={{ marginTop: 0 }}>
                                      <div
                                        className="fo-dash__progress-fill"
                                        style={{
                                          width: `${Math.min(100, Math.round((s.fulfillmentRate || 0) * 100))}%`,
                                          background: isHealthy
                                            ? "linear-gradient(90deg, #10b981, #059669)"
                                            : isWarn
                                            ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                            : "linear-gradient(90deg, #ef4444, #dc2626)",
                                        }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-[var(--navy)]">
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

                <div className="p-3 border-t border-[var(--fo-desk-line)] flex items-center justify-between text-[11px] text-[var(--ink-faint)]">
                  <span>Reconciliation matches logged in Module 15</span>
                  <Link href="/ops" className="text-[var(--cyan)] hover:underline font-semibold inline-flex items-center gap-1">
                    <span>Operations Queues</span>
                    <ArrowRightIcon className="h-3 w-3 inline" />
                  </Link>
                </div>
              </section>
            </div>

            {/* ── 5. Customer Economics & Average Order Value ───────────────── */}
            {(data.customerAnalytics.averageOrderValueByCurrency || []).length > 0 ? (
              <section className="fo-desk__panel fo-desk__panel--flush">
                <div className="fo-desk__panel-head p-4 pb-2">
                  <div>
                    <h2 className="fo-desk__section-label">Average Order Value (AOV) & Basket Analytics</h2>
                    <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                      Order basket sizes per currency derived from recognized customer sales
                    </p>
                  </div>
                  {data.customerAnalytics.loyaltyTiers && data.customerAnalytics.loyaltyTiers.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {data.customerAnalytics.loyaltyTiers.map((t) => (
                        <span key={t.tier} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">
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
                        <th>Average Order Value</th>
                        <th>Recognized Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customerAnalytics.averageOrderValueByCurrency.map((a) => (
                        <tr key={a.currency} className="hover:bg-slate-50/70 transition-colors">
                          <td className="font-bold text-[var(--navy)] font-mono">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-bold">
                              {a.currency}
                            </span>
                          </td>
                          <td className="font-semibold text-[var(--navy)] font-mono">{money(a.avgAmountMinor, a.currency)}</td>
                          <td className="font-mono text-xs text-[var(--ink-soft)]">{a.bookingCount.toLocaleString()} orders</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* ── 6. Operational Attention & Live Queue Health (SDS DB-01 SLA) ── */}
            <section className="fo-desk__panel">
              <div className="fo-desk__panel-head mb-3">
                <div>
                  <h2 className="fo-desk__section-label">Operational Attention & Queue SLA Health</h2>
                  <p className="text-[11.5px] text-[var(--ink-faint)] mt-0.5">
                    Real-time monitoring across human escalations, refunds, reconciliation, and journey disruptions
                  </p>
                </div>
                <Link href="/ops" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cyan)] hover:underline">
                  <span>Open Operations Console</span>
                  <ArrowRightIcon className="h-3 w-3 inline" />
                </Link>
              </div>

              <div className="fo-dash__queue-grid">
                {/* Open Escalations */}
                <div className={`fo-dash__queue-card ${data.operationalKpis.openEscalations > 0 ? "fo-dash__queue-card--warn" : "fo-dash__queue-card--nominal"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Open Escalations
                  </span>
                  <div className="fo-dash__queue-count">{data.operationalKpis.openEscalations}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    {data.operationalKpis.escalationsCreatedInRange} created in range
                  </span>
                </div>

                {/* Pending Refunds */}
                <div className={`fo-dash__queue-card ${data.operationalKpis.pendingRefunds > 0 ? "fo-dash__queue-card--warn" : "fo-dash__queue-card--nominal"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Pending Refunds
                  </span>
                  <div className="fo-dash__queue-count">{data.operationalKpis.pendingRefunds}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    Awaiting review
                  </span>
                </div>

                {/* Recon Review */}
                <div className={`fo-dash__queue-card ${data.operationalKpis.reconciliationNeedsAttention > 0 ? "fo-dash__queue-card--warn" : "fo-dash__queue-card--nominal"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Recon Reviews
                  </span>
                  <div className="fo-dash__queue-count">{data.operationalKpis.reconciliationNeedsAttention}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    Supplier items
                  </span>
                </div>

                {/* Recon Mismatches */}
                <div className={`fo-dash__queue-card ${data.operationalKpis.reconciliationMismatches > 0 ? "fo-dash__queue-card--alert" : "fo-dash__queue-card--nominal"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Recon Mismatches
                  </span>
                  <div className="fo-dash__queue-count">{data.operationalKpis.reconciliationMismatches}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    Discrepancies
                  </span>
                </div>

                {/* Outbox Pending / Failed */}
                <div className={`fo-dash__queue-card ${data.operationalKpis.opsOutboxFailed > 0 ? "fo-dash__queue-card--alert" : "fo-dash__queue-card--nominal"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Outbox Failed
                  </span>
                  <div className="fo-dash__queue-count">{data.operationalKpis.opsOutboxFailed}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    {data.operationalKpis.opsOutboxPending} pending
                  </span>
                </div>

                {/* Active Journey Watches */}
                <div className="fo-dash__queue-card fo-dash__queue-card--nominal">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Active Journeys
                  </span>
                  <div className="fo-dash__queue-count text-[var(--cyan)]">{data.operationalKpis.activeJourneyWatches}</div>
                  <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
                    {data.operationalKpis.journeyEventsInRange} events in range
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PermissionGate>
  );
}

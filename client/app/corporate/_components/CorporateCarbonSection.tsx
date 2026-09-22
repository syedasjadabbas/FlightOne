"use client";

import { useState } from "react";
import { Leaf } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useGetCarbonDashboardQuery, useGetCarbonNudgesQuery } from "@/lib/api/corporate.api";
import { DeskSectionHead, DeskStatus } from "./DeskSectionHead";

function kg(grams: number | null | undefined) {
  if (grams == null) return "—";
  return `${(grams / 1000).toFixed(1)} kg CO₂e`;
}

export function CorporateCarbonSection({ companyId }: { companyId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading, isError, refetch } = useGetCarbonDashboardQuery(
    {
      companyId,
      from: from || undefined,
      to: to || undefined,
    },
    { skip },
  );
  const { data: nudges } = useGetCarbonNudgesQuery(companyId, { skip });

  if (isError) {
    return (
      <section className="fo-desk__panel fo-desk__stack">
        <DeskSectionHead icon={Leaf} title="Carbon reporting" />
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Could not load the carbon dashboard.
        </p>
        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <DeskSectionHead icon={Leaf} title="Carbon reporting" />
      {data?.method.note ? (
        <p className="text-xs text-[var(--ink-soft)]">{data.method.note}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="From (YYYY-MM-DD)" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To (YYYY-MM-DD)" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading || !data ? (
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Loading carbon dashboard…
        </p>
      ) : (
        <>
          <div className="fo-desk__kpi-strip">
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Total</p>
              <p className="fo-desk__kpi-value">{kg(data.totals.gramsCo2e)}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Flights</p>
              <p className="fo-desk__kpi-value">{kg(data.totals.flightGramsCo2e)}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Hotels</p>
              <p className="fo-desk__kpi-value">{kg(data.totals.hotelGramsCo2e)}</p>
            </div>
            <div className="fo-desk__kpi">
              <p className="fo-desk__kpi-label">Coverage</p>
              <p className="fo-desk__kpi-value">
                {data.totals.estimatedCount}/{data.totals.bookingCount}
              </p>
              <p className="fo-desk__kpi-note">
                estimated
                {data.totals.insufficientCount
                  ? ` · ${data.totals.insufficientCount} insufficient`
                  : ""}
              </p>
            </div>
          </div>
          {data.breakdown.length ? (
            <div className="fo-desk__table-wrap -mx-1">
              <table className="fo-desk__table">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown.slice(0, 12).map((row) => (
                    <tr key={row.bookingId}>
                      <td className="fo-desk__mono">{row.bookingId.slice(0, 8)}</td>
                      <td>{row.product}</td>
                      <td>
                        <DeskStatus tone={row.status === "AVAILABLE" ? "ok" : "neutral"}>
                          {row.status}
                        </DeskStatus>
                      </td>
                      <td>
                        {row.status === "AVAILABLE"
                          ? kg(row.gramsCo2e)
                          : row.reason || "Insufficient data"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fo-desk__empty" style={{ padding: 0 }}>
              No verified company bookings in this period.
            </p>
          )}
        </>
      )}
      {nudges?.items?.length ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {nudges.items.map((n) => (
            <li
              key={n.kind + n.title}
              className="rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--white)] p-3"
            >
              <p className="text-sm font-medium text-[var(--navy)]">{n.title}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--ink-faint)]">
          {nudges?.emptyReason || "No policy nudges."}
        </p>
      )}
    </section>
  );
}

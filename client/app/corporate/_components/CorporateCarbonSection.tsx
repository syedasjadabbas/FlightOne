"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { useGetCarbonDashboardQuery, useGetCarbonNudgesQuery } from "@/lib/api/corporate.api";

function kg(grams: number | null | undefined) {
  if (grams == null) return "—";
  return `${(grams / 1000).toFixed(1)} kg CO₂e`;
}

export function CorporateCarbonSection({ companyId }: { companyId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useGetCarbonDashboardQuery({
    companyId,
    from: from || undefined,
    to: to || undefined,
  });
  const { data: nudges } = useGetCarbonNudgesQuery(companyId);

  return (
    <section className="fo-desk__panel fo-desk__stack">
      <h2 className="fo-desk__section-label">Carbon reporting</h2>
      <p className="text-xs text-slate-600">{data?.method.note}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="From (YYYY-MM-DD)" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To (YYYY-MM-DD)" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading || !data ? (
        <p className="fo-desk__empty">Loading carbon dashboard…</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <p className="text-sm">
              Total
              <strong className="block">{kg(data.totals.gramsCo2e)}</strong>
            </p>
            <p className="text-sm">
              Flights
              <strong className="block">{kg(data.totals.flightGramsCo2e)}</strong>
            </p>
            <p className="text-sm">
              Hotels
              <strong className="block">{kg(data.totals.hotelGramsCo2e)}</strong>
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {data.totals.estimatedCount} estimated / {data.totals.bookingCount} company bookings
            {data.totals.insufficientCount
              ? ` · ${data.totals.insufficientCount} without enough data (not invented)`
              : ""}
          </p>
          {data.breakdown.length ? (
            <div className="fo-desk__table-wrap">
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
                      <td>{row.bookingId.slice(0, 8)}</td>
                      <td>{row.product}</td>
                      <td>{row.status}</td>
                      <td>{row.status === "AVAILABLE" ? kg(row.gramsCo2e) : row.reason || "Insufficient data"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fo-desk__empty">No verified company bookings in this period.</p>
          )}
        </>
      )}
      {nudges?.items?.length ? (
        <ul className="space-y-2">
          {nudges.items.map((n) => (
            <li key={n.kind + n.title} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">{n.title}</p>
              <p className="text-xs text-slate-600">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">{nudges?.emptyReason || "No policy nudges."}</p>
      )}
    </section>
  );
}

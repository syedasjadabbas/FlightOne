"use client";

import { useMemo } from "react";
import { useGetCompanyAnalyticsQuery } from "@/lib/api/corporate.api";
import { AdvancedAnalyticsPanel } from "@/app/dashboard/AdvancedAnalyticsPanel";

export function CorporateAnalyticsSection({
  companyId,
  canRead,
}: {
  companyId: string;
  canRead: boolean;
}) {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const { data, isLoading, isError } = useGetCompanyAnalyticsQuery(
    { companyId, from: range.from, to: range.to },
    { skip: !canRead },
  );

  if (!canRead) {
    return (
      <section className="fo-desk__panel">
        <h2 className="fo-desk__section-label">Company analytics</h2>
        <p className="fo-desk__empty">Only company ADMIN or APPROVER can view organization analytics.</p>
      </section>
    );
  }

  return <AdvancedAnalyticsPanel data={data} isLoading={isLoading} isError={isError} />;
}

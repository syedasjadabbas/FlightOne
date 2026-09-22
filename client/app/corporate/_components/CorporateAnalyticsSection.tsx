"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useGetCompanyAnalyticsQuery } from "@/lib/api/corporate.api";
import { AdvancedAnalyticsPanel } from "@/app/dashboard/AdvancedAnalyticsPanel";
import { DeskSectionHead } from "./DeskSectionHead";

export function CorporateAnalyticsSection({
  companyId,
  canRead,
}: {
  companyId: string;
  canRead: boolean;
}) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken || !canRead;
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const { data, isLoading, isError } = useGetCompanyAnalyticsQuery(
    { companyId, from: range.from, to: range.to },
    { skip },
  );

  if (!canRead) {
    return (
      <section className="fo-desk__panel fo-desk__stack">
        <DeskSectionHead icon={BarChart3} title="Company analytics" />
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Only company ADMIN or APPROVER can view organization analytics.
        </p>
      </section>
    );
  }

  return <AdvancedAnalyticsPanel data={data} isLoading={isLoading} isError={isError} />;
}

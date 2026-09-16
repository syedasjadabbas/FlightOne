import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { OpsEscalationDetailClient } from "./OpsEscalationDetailClient";

export const metadata = {
  title: "Escalation detail — FlightOne",
};

export default async function OpsEscalationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsEscalationDetailClient id={id} />
      </DeskShell>
    </main>
  );
}

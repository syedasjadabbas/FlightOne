import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { EscalationDetailClient } from "./EscalationDetailClient";

export const metadata = {
  title: "Escalation — FlightOne",
};

export default async function EscalationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell>
        <EscalationDetailClient id={id} />
      </TravellerShell>
    </main>
  );
}

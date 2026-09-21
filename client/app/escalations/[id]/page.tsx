import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const EscalationDetailClient = dynamic(
  () =>
    import("./EscalationDetailClient").then((m) => ({
      default: m.EscalationDetailClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading case…" /> },
);

export const metadata = {
  title: "Support case — FlightOne",
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
      <TravellerShell width="narrow">
        <EscalationDetailClient id={id} />
      </TravellerShell>
    </main>
  );
}

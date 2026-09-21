import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";
import "../../ops-hub.css";
import "./ops-escalation-detail.css";

const OpsEscalationDetailClient = dynamic(
  () =>
    import("./OpsEscalationDetailClient").then((m) => ({
      default: m.OpsEscalationDetailClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading case…" /> },
);

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

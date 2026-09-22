import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";
import "../ops-hub.css";
import "./ops-escalations.css";

const OpsEscalationsClient = dynamic(
  () =>
    import("./OpsEscalationsClient").then((m) => ({
      default: m.OpsEscalationsClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading queue…" /> },
);

export const metadata = {
  title: "Consultant queue — FlightOne",
};

export default function OpsEscalationsPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsEscalationsClient />
      </DeskShell>
    </main>
  );
}

import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";
import "../ops-hub.css";
import "./knowledge.css";

const OpsKnowledgeClient = dynamic(
  () =>
    import("./OpsKnowledgeClient").then((m) => ({
      default: m.OpsKnowledgeClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading knowledge…" /> },
);

export const metadata = { title: "Knowledge — FlightOne Ops" };

export default function OpsKnowledgePage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsKnowledgeClient />
      </DeskShell>
    </main>
  );
}

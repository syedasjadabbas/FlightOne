import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { OpsKnowledgeClient } from "./OpsKnowledgeClient";
import "../ops-hub.css";
import "./knowledge.css";

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

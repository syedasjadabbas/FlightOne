import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { OpsEscalationsClient } from "./OpsEscalationsClient";

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

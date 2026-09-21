import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { MicePageClient } from "./MicePageClient";

export const metadata = {
  title: "MICE & Events — FlightOne",
  description:
    "Submit meetings, incentives, conferences, and exhibitions enquiries to the FlightOne MICE desk.",
};

export default function MicePage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <MicePageClient />
      </DeskShell>
    </main>
  );
}

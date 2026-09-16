import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { MicePageClient } from "./MicePageClient";

export const metadata = { title: "MICE — FlightOne" };

export default function MicePage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas>
        <MicePageClient />
      </DeskShell>
    </main>
  );
}

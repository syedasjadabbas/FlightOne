import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { CorporatePageClient } from "./CorporatePageClient";

export const metadata = { title: "Corporate travel — FlightOne" };

export default function CorporatePage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <CorporatePageClient />
      </DeskShell>
    </main>
  );
}

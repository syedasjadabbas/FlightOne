import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";

const CorporatePageClient = dynamic(
  () =>
    import("./CorporatePageClient").then((m) => ({
      default: m.CorporatePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading corporate…" /> },
);

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

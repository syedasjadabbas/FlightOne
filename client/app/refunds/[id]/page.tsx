import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const RefundCaseDetailClient = dynamic(
  () =>
    import("./RefundCaseDetailClient").then((m) => ({
      default: m.RefundCaseDetailClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading case…" /> },
);

export const metadata = { title: "Refund case — FlightOne" };

export default async function RefundCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="narrow">
        <RefundCaseDetailClient id={id} />
      </TravellerShell>
    </main>
  );
}

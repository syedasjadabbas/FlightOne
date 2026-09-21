import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { RefundCaseDetailClient } from "./RefundCaseDetailClient";

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

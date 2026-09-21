import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { MiceEventDetailClient } from "./MiceEventDetailClient";
import "./mice-event-detail.css";

export const metadata = { title: "MICE Event — FlightOne" };

export default async function MiceEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <MiceEventDetailClient eventId={eventId} />
      </DeskShell>
    </main>
  );
}

import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";
import "../ops-hub.css";
import "./ops-refunds.css";

const OpsRefundsClient = dynamic(
  () =>
    import("./OpsRefundsClient").then((m) => ({
      default: m.OpsRefundsClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading refunds ops…" /> },
);

export const metadata = { title: "Refunds ops — FlightOne" };

export default function OpsRefundsPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsRefundsClient />
      </DeskShell>
    </main>
  );
}

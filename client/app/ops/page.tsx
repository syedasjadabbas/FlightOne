import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";
import "./ops-hub.css";

const OpsPlatformClient = dynamic(
  () =>
    import("./OpsPlatformClient").then((m) => ({
      default: m.OpsPlatformClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading operations…" /> },
);

export const metadata = { title: "Operations — FlightOne" };

export default function OpsPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsPlatformClient />
      </DeskShell>
    </main>
  );
}

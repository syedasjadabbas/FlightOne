import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./vault.css";

const VaultPageClient = dynamic(
  () =>
    import("./VaultPageClient").then((m) => ({
      default: m.VaultPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading vault…" /> },
);

export const metadata = {
  title: "Vault — FlightOne",
  description: "Encrypted traveller vault for passports, visas, and travel documents.",
};

export default function VaultPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <VaultPageClient />
      </TravellerShell>
    </main>
  );
}

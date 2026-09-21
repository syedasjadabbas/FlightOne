import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { VaultPageClient } from "./VaultPageClient";
import "./vault.css";

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

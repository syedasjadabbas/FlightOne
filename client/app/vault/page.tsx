import dynamic from "next/dynamic";
import { BrandedLoader } from "@/components/BrandedLoader";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./vault.css";

const VaultPageClient = dynamic(
  () =>
    import("./VaultPageClient").then((m) => ({
      default: m.VaultPageClient,
    })),
  {
    loading: () => (
      <BrandedLoader
        title="Loading Document Vault…"
        subtitle="Establishing encrypted tunnel & biometric authentication protocols."
        badge="AES-256 ENCRYPTED"
      />
    ),
  },
);

export const metadata = {
  title: "Vault — FlightOne",
  description: "Encrypted traveller vault for passports, visas, and travel documents.",
};

export default function VaultPage() {
  return (
    <main className="fo-stage relative flex min-h-dvh flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <VaultPageClient />
      </TravellerShell>
    </main>
  );
}

import dynamic from "next/dynamic";
import { BrandedLoader } from "@/components/BrandedLoader";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./journey.css";

const JourneyPageClient = dynamic(
  () =>
    import("./JourneyPageClient").then((m) => ({
      default: m.JourneyPageClient,
    })),
  {
    loading: () => (
      <BrandedLoader
        title="Loading Live Journey Radar…"
        subtitle="Initializing satellite tracking, gate telemetry & active routes."
        badge="LIVE RADAR ACTIVE"
      />
    ),
  },
);

export const metadata = {
  title: "My Journey — FlightOne",
  description: "Live flight radar, gate alerts, and verified trip tracking.",
};

export default function JourneyPage() {
  return (
    <main className="fo-stage relative flex min-h-dvh flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <JourneyPageClient />
      </TravellerShell>
    </main>
  );
}

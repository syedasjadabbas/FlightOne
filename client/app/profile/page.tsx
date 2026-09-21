import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const ProfilePageClient = dynamic(
  () =>
    import("./ProfilePageClient").then((m) => ({
      default: m.ProfilePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading profile…" /> },
);

export const metadata = {
  title: "Profile — FlightOne",
};

export default function ProfilePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <ProfilePageClient />
      </TravellerShell>
    </main>
  );
}

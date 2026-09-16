import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { ProfilePageClient } from "./ProfilePageClient";

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

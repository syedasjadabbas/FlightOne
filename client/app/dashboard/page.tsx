import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { ManagementDashboardClient } from "./ManagementDashboardClient";

export const metadata = { title: "Management dashboard — FlightOne" };

export default function ManagementDashboardPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <ManagementDashboardClient />
      </DeskShell>
    </main>
  );
}

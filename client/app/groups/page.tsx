import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { GroupsPageClient } from "./GroupsPageClient";

export const metadata = {
  title: "Groups — FlightOne",
};

export default function GroupsPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <GroupsPageClient />
      </DeskShell>
    </main>
  );
}

import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { GroupDetailClient } from "./GroupDetailClient";

export const metadata = {
  title: "Group — FlightOne",
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <GroupDetailClient groupId={groupId} />
      </DeskShell>
    </main>
  );
}

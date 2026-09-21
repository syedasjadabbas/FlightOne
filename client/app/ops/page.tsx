import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { OpsPlatformClient } from "./OpsPlatformClient";
import "./ops-hub.css";

export const metadata = { title: "Operations — FlightOne" };

export default function OpsPlatformPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsPlatformClient />
      </DeskShell>
    </main>
  );
}

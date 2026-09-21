import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { OpsRefundsClient } from "./OpsRefundsClient";
import "../ops-hub.css";
import "./ops-refunds.css";

export const metadata = { title: "Refunds ops — FlightOne" };

export default function OpsRefundsPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <OpsRefundsClient />
      </DeskShell>
    </main>
  );
}

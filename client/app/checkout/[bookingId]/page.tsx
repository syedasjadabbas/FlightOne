import { SiteNav } from "@/components/SiteNav";
import { DeskShell } from "@/components/DeskShell";
import { CheckoutClient } from "./CheckoutClient";

export const metadata = {
  title: "Checkout — FlightOne",
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell checkout>
        <CheckoutClient bookingId={bookingId} />
      </DeskShell>
    </main>
  );
}

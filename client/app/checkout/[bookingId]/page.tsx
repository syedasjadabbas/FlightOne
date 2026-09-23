import dynamic from "next/dynamic";
import { CheckoutBrandedLoader } from "./_components/CheckoutBrandedLoader";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";

const CheckoutClient = dynamic(
  () =>
    import("./CheckoutClient").then((m) => ({
      default: m.CheckoutClient,
    })),
  {
    loading: () => (
      <CheckoutBrandedLoader
        title="Loading checkout workspace…"
        subtitle="Initializing FlightOne encrypted booking session & reservation systems."
      />
    ),
  },
);

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
    <main className="fo-stage fo-stage--desk relative flex min-h-dvh flex-col">
      <SiteNav />
      <DeskShell checkout>
        <CheckoutClient bookingId={bookingId} />
      </DeskShell>
    </main>
  );
}

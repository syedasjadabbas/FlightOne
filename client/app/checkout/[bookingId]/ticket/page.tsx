import type { Metadata } from "next";
import { TicketPrintClient } from "./_TicketPrintClient";

export const metadata: Metadata = {
  title: "FlightOne — E-Ticket",
};

export default async function TicketPrintPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <TicketPrintClient bookingId={bookingId} />;
}

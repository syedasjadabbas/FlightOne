"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Compass, Plane, Sparkles } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
  paginateItems,
} from "@/app/components/traveller";
import { useGetTravelHistoryQuery } from "@/lib/api/profile.api";

export function TravelHistorySection() {
  const { data, isLoading, isError } = useGetTravelHistoryQuery({ limit: 50 });
  const [page, setPage] = useState(1);
  const items = data?.items ?? [];
  const pageItems = paginateItems(items, page, TRAVELLER_PAGE_SIZE);

  return (
    <TravellerSection
      title="Travel & Booking History"
      note={
        <span>
          Confirmed flight reservations and itineraries. For active live flight tracking, visit{" "}
          <Link href="/journey" className="font-semibold text-sky underline-offset-2 hover:underline">
            Journey Watches
          </Link>
          .
        </span>
      }
      panel
    >
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Spinner label="Loading flight bookings…" />
        </div>
      ) : null}

      {isError ? (
        <TravellerState variant="error" title="History Unavailable">
          Could not load recent bookings.
        </TravellerState>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/60 p-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky/10 text-sky">
                <Compass size={13} strokeWidth={2.2} />
              </span>
              <span className="text-[12.5px] font-bold text-navy">
                {data.stats.totalBookings} Total Bookings · {data.stats.completedBookings} Completed
              </span>
            </div>
            {data.patterns?.frequentRoutes?.length ? (
              <span className="text-[12px] text-ink-soft">
                Top routes: <strong>{data.patterns.frequentRoutes.slice(0, 3).join(" · ")}</strong>
              </span>
            ) : null}
          </div>

          {!items.length ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky/10 text-sky">
                <Plane size={18} strokeWidth={2} />
              </div>
              <p className="text-[14px] font-semibold text-navy">No Bookings Recorded Yet</p>
              <p className="text-[12.5px] text-ink-soft">Complete a flight reservation to track your itinerary history here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pageItems.map((b) => (
                <Link
                  key={b.id}
                  href={`/checkout/${b.id}`}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white/90 p-4 shadow-sm transition-all hover:border-sky hover:shadow-md"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky/10 text-sky group-hover:bg-navy group-hover:text-white transition-colors">
                      <Plane size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-navy">{b.product}</span>
                        <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft uppercase">
                          {b.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-mono text-ink-faint">
                        Ref: {b.id.slice(0, 16)}…
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[14px] font-bold text-navy">
                      {b.currency} {(b.amountMinor / 100).toFixed(2)}
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/4 text-ink-faint group-hover:bg-sky group-hover:text-white transition-colors">
                      <ChevronRight size={14} strokeWidth={2.5} />
                    </div>
                  </div>
                </Link>
              ))}

              <div className="pt-2">
                <TravellerPagination
                  page={page}
                  total={items.length}
                  onPageChange={setPage}
                  label="Travel history pages"
                />
              </div>
            </div>
          )}
        </>
      ) : null}
    </TravellerSection>
  );
}

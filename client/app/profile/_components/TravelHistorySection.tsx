"use client";

import { useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui";
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
      title="Travel history"
      note={
        <>
          Bookings from Module 03 — not a separate invented history store.{" "}
          <Link href="/journey">Journey watches</Link>
        </>
      }
    >
      {isLoading ? <Spinner label="Loading history" /> : null}
      {isError ? (
        <TravellerState variant="error" title="History unavailable">
          Could not load bookings.
        </TravellerState>
      ) : null}
      {data ? (
        <>
          <p className="fo-traveller__meta">
            {data.stats.totalBookings} bookings · {data.stats.completedBookings} completed
            {data.patterns?.frequentRoutes?.length
              ? ` · routes ${data.patterns.frequentRoutes.slice(0, 3).join(", ")}`
              : ""}
          </p>
          {!items.length ? (
            <TravellerState title="No bookings yet">
              Complete a checkout to build travel history here.
            </TravellerState>
          ) : (
            <>
              <ul className="fo-traveller__list">
                {pageItems.map((b) => (
                  <li key={b.id}>
                    <Link href={`/checkout/${b.id}`} className="fo-traveller__row-link">
                      <div className="fo-traveller__row-top">
                        <p className="fo-traveller__row-title">
                          {b.product} · {b.status}
                        </p>
                        <span className="fo-traveller__row-meta">
                          {b.currency} {(b.amountMinor / 100).toFixed(2)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <TravellerPagination
                page={page}
                total={items.length}
                onPageChange={setPage}
                label="Travel history pages"
              />
            </>
          )}
        </>
      ) : null}
    </TravellerSection>
  );
}

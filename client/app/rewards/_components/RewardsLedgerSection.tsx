"use client";

import {
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
} from "@/app/components/traveller";
import type { RewardLedgerEntry } from "@/lib/api/rewards.api";
import { formatPts, labelize } from "./rewardsFormat";

type RewardsLedgerSectionProps = {
  items: RewardLedgerEntry[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  entryDetail: RewardLedgerEntry | undefined;
  entryLoading: boolean;
  entryError: boolean;
};

export function RewardsLedgerSection({
  items,
  total,
  page,
  onPageChange,
  selectedEntryId,
  onSelectEntry,
  entryDetail,
  entryLoading,
  entryError,
}: RewardsLedgerSectionProps) {
  return (
    <TravellerSection title="Rewards ledger history">
      {items.length === 0 ? (
        <TravellerState title="No transactions on record">
          Points from ticketed bookings and referral bonuses will appear here after the ledger posts
          them.
        </TravellerState>
      ) : (
        <>
          <ul className="fo-traveller__list">
            {items.map((row) => {
              const open = selectedEntryId === row.id;
              return (
                <li key={row.id} className="fo-traveller__row">
                  <button
                    type="button"
                    className="fo-rewards__ledger-btn"
                    aria-expanded={open}
                    onClick={() => onSelectEntry(open ? null : row.id)}
                  >
                    <div>
                      <p className="fo-traveller__row-title">{labelize(row.type)}</p>
                      <p className="fo-traveller__row-body">{row.note || "—"}</p>
                      <p className="fo-traveller__row-meta">
                        {new Date(row.createdAt).toLocaleString()}
                        {open ? " · details open" : " · view details"}
                      </p>
                    </div>
                    <span
                      className={
                        row.points >= 0 ? "fo-rewards__pts fo-rewards__pts--credit" : "fo-rewards__pts"
                      }
                    >
                      {formatPts(row.points)} pts
                    </span>
                  </button>
                  {open ? (
                    <div className="fo-rewards__detail">
                      {entryLoading ? (
                        <p>Loading ledger details…</p>
                      ) : entryError || !entryDetail ? (
                        <p>Could not load this ledger entry.</p>
                      ) : (
                        <dl>
                          <div>
                            <dt>Entry</dt>
                            <dd className="mono">{entryDetail.id}</dd>
                          </div>
                          <div>
                            <dt>Type</dt>
                            <dd>{labelize(entryDetail.type)}</dd>
                          </div>
                          <div>
                            <dt>Booking</dt>
                            <dd>{entryDetail.bookingId || "—"}</dd>
                          </div>
                          <div>
                            <dt>Expires</dt>
                            <dd>
                              {entryDetail.expiresAt
                                ? new Date(entryDetail.expiresAt).toLocaleDateString()
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <TravellerPagination
            page={page}
            pageSize={TRAVELLER_PAGE_SIZE}
            total={total}
            onPageChange={onPageChange}
            label="Rewards ledger pages"
          />
        </>
      )}
    </TravellerSection>
  );
}

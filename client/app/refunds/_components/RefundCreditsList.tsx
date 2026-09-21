import { Wallet } from "lucide-react";
import { TravellerChip, TravellerSection } from "@/app/components/traveller";
import { formatMinor } from "./refundFormat";

type CreditItem = Record<string, unknown>;

export function RefundCreditsList({ items }: { items: CreditItem[] }) {
  if (!items.length) return null;

  return (
    <TravellerSection title="Travel credit vouchers">
      <ul className="fo-traveller__list">
        {items.map((t) => {
          const id = String(t.id ?? "");
          const remaining = Number(t.remainingMinor);
          const currency = String(t.currency ?? "");
          const status = String(t.status ?? "");
          return (
            <li key={id} className="fo-traveller__row">
              <div className="fo-traveller__row-top">
                <p className="fo-traveller__row-title inline-flex items-center gap-1.5">
                  <Wallet size={14} strokeWidth={1.75} className="text-[var(--sky)]" aria-hidden />
                  <span className="fo-refunds__amount-ok">
                    {formatMinor(remaining, currency)}
                  </span>
                  <span className="font-normal text-[var(--ink-faint)]">remaining</span>
                </p>
                <TravellerChip tone="default">{status}</TravellerChip>
              </div>
              <p className="fo-traveller__row-meta">
                Voucher {id.slice(0, 10)}… · Redeemable at future flight or hotel checkout
              </p>
            </li>
          );
        })}
      </ul>
    </TravellerSection>
  );
}

"use client";

import { TravellerSection } from "@/app/components/traveller";
import { useGetCorporateRewardProgramQuery } from "@/lib/api/rewards.api";

function CorporateRewardsBlock({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { data, isError } = useGetCorporateRewardProgramQuery(companyId);
  if (isError) return null;
  return (
    <li className="fo-traveller__row">
      <p className="fo-traveller__row-title">{companyName}</p>
      {!data?.configured ? (
        <p className="fo-traveller__row-meta">
          No corporate programme configured yet (ADMIN can set via Corporate Desk).
        </p>
      ) : (
        <p className="fo-traveller__row-body">
          Company balance: {data.balance} pts
          {data.program?.personalEarnEnabled === false ? " · personal earn disabled" : ""}
          {data.program?.isActive === false ? " · inactive" : ""}
        </p>
      )}
    </li>
  );
}

type CorporateRewardsListProps = {
  companies: Array<{ id: string; name: string }>;
};

export function CorporateRewardsList({ companies }: CorporateRewardsListProps) {
  if (companies.length === 0) return null;

  return (
    <TravellerSection
      title="Corporate loyalty programs"
      note="Company-level reward balances are segregated from your personal rewards ledger."
    >
      <ul className="fo-traveller__list">
        {companies.map((c) => (
          <CorporateRewardsBlock key={c.id} companyId={c.id} companyName={c.name} />
        ))}
      </ul>
    </TravellerSection>
  );
}

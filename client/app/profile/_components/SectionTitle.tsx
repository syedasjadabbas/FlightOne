"use client";

/** Thin alias kept for local imports — prefer TravellerSection titles. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="fo-traveller__section-title">{children}</h2>;
}

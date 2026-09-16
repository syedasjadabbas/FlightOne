"use client";

import { Pagination, pageCountFor } from "@/components/ui";
import { cn } from "@/utils/cn";

export const TRAVELLER_PAGE_SIZE = 10;

export {
  paginateItems,
  pageCountFor,
} from "@/components/ui";

export type TravellerPaginationProps = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
};

/** Traveller-scoped wrapper around shared Pagination. */
export function TravellerPagination({
  page,
  pageSize = TRAVELLER_PAGE_SIZE,
  total,
  onPageChange,
  className,
  label = "Pagination",
}: TravellerPaginationProps) {
  const count = pageCountFor(total, pageSize);
  if (total <= pageSize) return null;

  return (
    <Pagination
      page={page}
      pageCount={count}
      onPageChange={onPageChange}
      totalItems={total}
      pageSize={pageSize}
      label={label}
      className={cn("fo-traveller__pager", className)}
    />
  );
}

import type { MiceEnquiryStatus } from "@/lib/api/mice.api";

type ChipTone = "ok" | "warn" | "muted" | "danger";

function toneForStatus(status: MiceEnquiryStatus): ChipTone {
  switch (status) {
    case "SUBMITTED":
      return "warn";
    case "IN_REVIEW":
      return "ok";
    case "CANCELLED":
      return "danger";
    default:
      return "muted";
  }
}

export function MiceStatusChip({
  status,
  attendees,
}: {
  status: MiceEnquiryStatus;
  attendees?: number;
}) {
  const tone = toneForStatus(status);
  return (
    <span className={`fo-gm-chip fo-gm-chip--${tone}`}>
      {status.replace(/_/g, " ")}
      {typeof attendees === "number" ? ` · ${attendees} pax` : null}
    </span>
  );
}

import { CircleHelp, FileCheck2 } from "lucide-react";
import type { VisaAssessment } from "@/lib/api/visa.api";

type Checklist = {
  items?: Array<{ item: string; presentHint?: boolean; matchHint?: string | null }>;
  missingCount?: number;
  note?: string;
};

export function VisaChecklist({ checklist }: { checklist: VisaAssessment["checklist"] }) {
  if (!checklist || typeof checklist !== "object") return null;
  const c = checklist as Checklist;

  if (!c.items?.length) {
    return (
      <p className="fo-visa__check-meta">{c.note || "No specific documents listed for this route."}</p>
    );
  }

  return (
    <div>
      <ul className="fo-visa__check-list">
        {c.items.map((item) => (
          <li key={item.item} className="fo-visa__check-item">
            <span
              className={`fo-visa__check-mark${item.presentHint ? "" : " fo-visa__check-mark--missing"}`}
              aria-hidden="true"
            >
              {item.presentHint ? (
                <FileCheck2 size={13} />
              ) : (
                <CircleHelp size={13} />
              )}
            </span>
            <div>
              <p className="fo-visa__check-title">{item.item}</p>
              <p className="fo-visa__check-meta">
                {item.presentHint ? "Hint: found in profile / vault" : "Hint: not found in profile / vault"}
                {item.matchHint ? ` — ${item.matchHint}` : ""}
              </p>
              <p className="fo-visa__check-meta">
                Advisory checklist only — not a legal determination of sufficiency.
              </p>
            </div>
          </li>
        ))}
      </ul>
      {c.note ? <p className="fo-visa__check-meta" style={{ marginTop: "0.65rem" }}>{c.note}</p> : null}
    </div>
  );
}

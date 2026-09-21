import { AlertTriangle, CheckCircle2, ClipboardList, HandHelping } from "lucide-react";

type Summary = {
  total: number;
  actionable: number;
  requiresHuman: number;
  completed: number;
  failed: number;
};

export function OpsRefundsSummary({ summary }: { summary: Summary }) {
  return (
    <section className="fo-desk__kpi-strip" aria-label="Queue summary">
      <div className="fo-desk__kpi">
        <p className="fo-desk__kpi-label">
          <ClipboardList className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
          Needs action
        </p>
        <p className="fo-desk__kpi-value">{summary.actionable}</p>
        <p className="fo-desk__kpi-note">Submitted · processing · human</p>
      </div>
      <div className="fo-desk__kpi">
        <p className="fo-desk__kpi-label">
          <HandHelping className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
          Requires human
        </p>
        <p className="fo-desk__kpi-value">{summary.requiresHuman}</p>
        <p className="fo-desk__kpi-note">Agent follow-up</p>
      </div>
      <div className="fo-desk__kpi">
        <p className="fo-desk__kpi-label">
          <CheckCircle2 className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
          Completed
        </p>
        <p className="fo-desk__kpi-value">{summary.completed}</p>
        <p className="fo-desk__kpi-note">Confirmed payouts</p>
      </div>
      <div className="fo-desk__kpi">
        <p className="fo-desk__kpi-label">
          <AlertTriangle className="fo-ops__kpi-icon h-3 w-3" aria-hidden />
          Failed
        </p>
        <p className="fo-desk__kpi-value">{summary.failed}</p>
        <p className="fo-desk__kpi-note">{summary.total} total cases</p>
      </div>
    </section>
  );
}

import { labelize } from "./refundFormat";

export type RefundAuditRow = {
  id: string;
  action: string;
  createdAt: string;
};

export function RefundAuditList({ rows }: { rows: RefundAuditRow[] }) {
  return (
    <ul className="fo-refund-detail__timeline">
      {rows.map((row) => (
        <li key={row.id} className="fo-refund-detail__event">
          <div className="fo-refund-detail__event-dot" aria-hidden>
            <span />
          </div>
          <div>
            <p className="fo-refund-detail__event-title">{labelize(row.action)}</p>
            <p className="fo-refund-detail__event-meta">
              <time dateTime={row.createdAt}>
                {new Date(row.createdAt).toLocaleString()}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

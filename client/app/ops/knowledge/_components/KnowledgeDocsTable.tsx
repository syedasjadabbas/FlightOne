import { BookMarked, Library } from "lucide-react";
import { Button, Pagination, pageCountFor, paginateItems } from "@/components/ui";
import type { KnowledgeDocument } from "@/lib/api/knowledge.api";
import { KnowledgeSectionHead, KnowledgeStatus } from "./KnowledgeSectionHead";
import { humanizeToken, statusTone } from "./knowledgeLabels";

export function KnowledgeDocsEmpty() {
  return (
    <div className="fo-desk__panel">
      <div className="fo-kb__empty">
        <div className="fo-kb__empty-icon" aria-hidden>
          <Library className="h-5 w-5" strokeWidth={2} />
        </div>
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          No knowledge documents yet. Create and publish content before Ava can ground policy
          answers.
        </p>
      </div>
    </div>
  );
}

export function KnowledgeDocsTable({
  items,
  page,
  pageSize,
  canWrite,
  onPageChange,
  onPageSizeChange,
  onPublish,
  onArchive,
  onNewVersion,
}: {
  items: KnowledgeDocument[];
  page: number;
  pageSize: number;
  canWrite: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onPublish: (id: string, title: string) => void;
  onArchive: (id: string, title: string) => void;
  onNewVersion: (id: string) => void;
}) {
  return (
    <section className="fo-desk__panel fo-desk__panel--flush">
      <KnowledgeSectionHead
        icon={BookMarked}
        title="Documents"
        flush
        trailing={
          <span className="fo-kb__count">
            {items.length} {items.length === 1 ? "document" : "documents"}
          </span>
        }
      />
      <div className="fo-desk__table-wrap">
        <table className="fo-desk__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Chunks</th>
              {canWrite ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {paginateItems(items, page, pageSize).map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="font-medium text-navy">{d.title}</span>{" "}
                  <span className="fo-desk__mono text-ink-faint">v{d.version}</span>
                </td>
                <td>{humanizeToken(d.category)}</td>
                <td>
                  <KnowledgeStatus
                    status={humanizeToken(d.status)}
                    tone={statusTone(d.status)}
                  />
                </td>
                <td>{humanizeToken(d.visibility)}</td>
                <td className="fo-desk__mono">{d.chunkCount ?? 0}</td>
                {canWrite ? (
                  <td>
                    <div className="fo-desk__toolbar">
                      {d.status !== "PUBLISHED" ? (
                        <Button size="sm" onClick={() => onPublish(d.id, d.title)}>
                          Publish
                        </Button>
                      ) : null}
                      {d.status === "PUBLISHED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onArchive(d.id, d.title)}
                        >
                          Archive
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => onNewVersion(d.id)}>
                        New version
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageCount={pageCountFor(items.length, pageSize)}
        onPageChange={onPageChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        totalItems={items.length}
        label="Knowledge documents"
      />
    </section>
  );
}

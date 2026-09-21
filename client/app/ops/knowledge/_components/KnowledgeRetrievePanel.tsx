import { Search } from "lucide-react";
import { Button } from "@/components/ui";
import { KnowledgeSectionHead } from "./KnowledgeSectionHead";

export function KnowledgeRetrievePanel({
  previewQuery,
  previewResult,
  busy,
  onQueryChange,
  onRetrieve,
}: {
  previewQuery: string;
  previewResult: string | null;
  busy?: boolean;
  onQueryChange: (v: string) => void;
  onRetrieve: () => void;
}) {
  return (
    <section className="fo-desk__panel fo-desk__stack">
      <KnowledgeSectionHead icon={Search} title="Retrieval preview" />
      <p className="fo-kb__hint">
        Test what Ava would retrieve in ops mode before publishing a document to production
        grounding.
      </p>
      <div className="fo-desk__toolbar">
        <label className="fo-kb__search fo-kb__search--flex">
          <span className="sr-only">Test retrieval query</span>
          <input
            className="fo-kb__input fo-kb__input--grow"
            placeholder="Test query — e.g. refund window PK"
            value={previewQuery}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !previewQuery.trim()}
          onClick={onRetrieve}
        >
          Retrieve
        </Button>
      </div>
      {previewResult ? (
        <pre className="fo-kb__preview" role="status">
          {previewResult}
        </pre>
      ) : null}
    </section>
  );
}

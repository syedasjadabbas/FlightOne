import { Filter } from "lucide-react";
import { SearchableSelect } from "@/components/ui";
import type { KnowledgeCategory, KnowledgeStatus } from "@/lib/api/knowledge.api";
import { KnowledgeSectionHead } from "./KnowledgeSectionHead";
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from "./knowledgeLabels";

export function KnowledgeFilters({
  category,
  status,
  q,
  onCategoryChange,
  onStatusChange,
  onQueryChange,
}: {
  category: KnowledgeCategory | "";
  status: KnowledgeStatus | "";
  q: string;
  onCategoryChange: (v: KnowledgeCategory | "") => void;
  onStatusChange: (v: KnowledgeStatus | "") => void;
  onQueryChange: (v: string) => void;
}) {
  return (
    <section className="fo-desk__panel fo-desk__stack">
      <KnowledgeSectionHead icon={Filter} title="Filters" />
      <div className="fo-desk__toolbar">
        <SearchableSelect
          className="min-w-[10rem]"
          options={[{ value: "", label: "All categories" }, ...CATEGORY_OPTIONS]}
          value={category}
          onChange={(v) => onCategoryChange(v as KnowledgeCategory | "")}
          placeholder="All categories"
          clearable
        />
        <SearchableSelect
          className="min-w-[9rem]"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => onStatusChange(v as KnowledgeStatus | "")}
          searchable={false}
          placeholder="All statuses"
          clearable
        />
        <label className="fo-kb__search">
          <span className="sr-only">Search title or content</span>
          <input
            className="fo-kb__input fo-kb__input--grow"
            placeholder="Search title or content"
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}

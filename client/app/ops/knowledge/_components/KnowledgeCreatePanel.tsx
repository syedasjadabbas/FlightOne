import { FilePlus2 } from "lucide-react";
import { Button, SearchableSelect } from "@/components/ui";
import type { KnowledgeCategory, KnowledgeVisibility } from "@/lib/api/knowledge.api";
import { KnowledgeSectionHead } from "./KnowledgeSectionHead";
import { CATEGORY_OPTIONS, VISIBILITY_OPTIONS } from "./knowledgeLabels";

export function KnowledgeCreatePanel({
  title,
  createCategory,
  visibility,
  content,
  publishOnCreate,
  busy,
  onTitleChange,
  onCategoryChange,
  onVisibilityChange,
  onContentChange,
  onPublishChange,
  onSubmit,
}: {
  title: string;
  createCategory: KnowledgeCategory;
  visibility: KnowledgeVisibility;
  content: string;
  publishOnCreate: boolean;
  busy?: boolean;
  onTitleChange: (v: string) => void;
  onCategoryChange: (v: KnowledgeCategory) => void;
  onVisibilityChange: (v: KnowledgeVisibility) => void;
  onContentChange: (v: string) => void;
  onPublishChange: (v: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="fo-desk__panel fo-desk__stack">
      <KnowledgeSectionHead icon={FilePlus2} title="Create document" />
      <label className="fo-kb__field">
        <span className="fo-kb__label">Title</span>
        <input
          className="fo-kb__input"
          placeholder="e.g. Refund SOP — PK carriers"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>
      <div className="fo-desk__toolbar">
        <label className="fo-kb__field fo-kb__field--inline">
          <span className="fo-kb__label">Category</span>
          <SearchableSelect
            className="min-w-[10rem]"
            options={CATEGORY_OPTIONS}
            value={createCategory}
            onChange={(v) => onCategoryChange(v as KnowledgeCategory)}
          />
        </label>
        <label className="fo-kb__field fo-kb__field--inline">
          <span className="fo-kb__label">Visibility</span>
          <SearchableSelect
            className="min-w-[9rem]"
            options={VISIBILITY_OPTIONS}
            value={visibility}
            onChange={(v) => onVisibilityChange(v as KnowledgeVisibility)}
            searchable={false}
          />
        </label>
        <label className="fo-kb__check">
          <input
            type="checkbox"
            checked={publishOnCreate}
            onChange={(e) => onPublishChange(e.target.checked)}
          />
          Publish immediately
        </label>
      </div>
      <label className="fo-kb__field">
        <span className="fo-kb__label">Content</span>
        <textarea
          className="fo-kb__textarea"
          placeholder="Paste authoritative content only — never invent policy"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={6}
        />
      </label>
      <div>
        <Button size="sm" disabled={busy || !title.trim() || !content.trim()} onClick={onSubmit}>
          Create document
        </Button>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Pagination, SearchableSelect, Spinner, pageCountFor, paginateItems } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  useArchiveKnowledgeDocumentMutation,
  useCreateKnowledgeDocumentMutation,
  useCreateKnowledgeVersionMutation,
  useListKnowledgeDocumentsQuery,
  usePublishKnowledgeDocumentMutation,
  useRetrieveKnowledgeMutation,
  type KnowledgeCategory,
  type KnowledgeStatus,
  type KnowledgeVisibility,
} from "@/lib/api/knowledge.api";
import { usePermissions } from "@/lib/permissions/usePermissions";
import { useAuthStore } from "@/store/auth.store";

const CATEGORIES: KnowledgeCategory[] = [
  "SOP",
  "AIRLINE_POLICY",
  "SUPPLIER_RULE",
  "CORPORATE_TRAVEL_POLICY",
  "VISA_RULE",
  "SUPPLIER_CONTRACT",
  "VISA_PROCEDURE",
  "CORPORATE_AGREEMENT",
  "TRAVEL_POLICY",
];

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c.replaceAll("_", " ") }));

const STATUS_OPTIONS: { value: KnowledgeStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "PUBLISHED", label: "PUBLISHED" },
  { value: "ARCHIVED", label: "ARCHIVED" },
  { value: "EXPIRED", label: "EXPIRED" },
];

const VISIBILITY_OPTIONS: { value: KnowledgeVisibility; label: string }[] = [
  { value: "CUSTOMER_SAFE", label: "CUSTOMER_SAFE" },
  { value: "INTERNAL", label: "INTERNAL" },
  { value: "RESTRICTED", label: "RESTRICTED" },
];

const inputClass =
  "rounded border border-[var(--fo-desk-line)] bg-white px-2 py-1.5 text-[13px]";

const PAGE_SIZE_DEFAULT = 10;

export function OpsKnowledgeClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { isLoading: permsLoading, hasAny } = usePermissions();
  const canRead = hasAny(["knowledge:read", "knowledge:write", "ops:dashboard:read"]);
  const canWrite = hasAny(["knowledge:write", "ops:dashboard:read"]);

  const [category, setCategory] = useState<KnowledgeCategory | "">("");
  const [status, setStatus] = useState<KnowledgeStatus | "">("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [createCategory, setCreateCategory] = useState<KnowledgeCategory>("SOP");
  const [visibility, setVisibility] = useState<KnowledgeVisibility>("INTERNAL");
  const [content, setContent] = useState("");
  const [publishOnCreate, setPublishOnCreate] = useState(false);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const listParams = useMemo(
    () => ({
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [category, status, q],
  );

  const { data, isLoading, refetch } = useListKnowledgeDocumentsQuery(listParams, {
    skip: skip || !canRead,
  });
  const [createDoc] = useCreateKnowledgeDocumentMutation();
  const [createVersion] = useCreateKnowledgeVersionMutation();
  const [publishDoc] = usePublishKnowledgeDocumentMutation();
  const [archiveDoc] = useArchiveKnowledgeDocumentMutation();
  const [retrieve] = useRetrieveKnowledgeMutation();

  if (!hasHydrated || permsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!accessToken) {
    return (
      <div className="fo-desk__panel">
        <p className="fo-desk__empty">Sign in required.</p>
      </div>
    );
  }

  return (
    <PermissionGate
      anyOf={["knowledge:read", "knowledge:write", "ops:dashboard:read"]}
      mode="fallback"
      fallback={
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Knowledge</h1>
          <p className="fo-desk__lede">
            Missing `knowledge:read` / `ops:dashboard:read` permission.
          </p>
          <div className="fo-desk__links">
            <Link href="/ops">Operations</Link>
          </div>
        </header>
      }
    >
      <div className="fo-desk__stack" style={{ gap: "1.25rem" }}>
        <header className="fo-desk__header">
          <h1 className="fo-desk__title">Knowledge</h1>
          <p className="fo-desk__lede">
            Internal SOPs and policies for Ava grounding. Not Traveller Vault — do not invent policy
            content.
          </p>
          <div className="fo-desk__links">
            <Link href="/ops">← Operations</Link>
          </div>
        </header>

        {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}

        <section className="fo-desk__panel fo-desk__stack">
          <p className="fo-desk__section-label">Filters</p>
          <div className="fo-desk__toolbar">
            <SearchableSelect
              className="min-w-[10rem]"
              options={[{ value: "", label: "All categories" }, ...CATEGORY_OPTIONS]}
              value={category}
              onChange={(v) => {
                setCategory(v as KnowledgeCategory | "");
                setPage(1);
              }}
              placeholder="All categories"
              clearable
            />
            <SearchableSelect
              className="min-w-[9rem]"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => {
                setStatus(v as KnowledgeStatus | "");
                setPage(1);
              }}
              searchable={false}
              placeholder="All statuses"
              clearable
            />
            <input
              className={`min-w-[10rem] flex-1 ${inputClass} px-3`}
              placeholder="Search title/content"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </section>

        {canWrite ? (
          <section className="fo-desk__panel fo-desk__stack">
            <p className="fo-desk__section-label">Create document</p>
            <input
              className={`w-full ${inputClass} px-3 py-2 text-[14px]`}
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="fo-desk__toolbar">
              <SearchableSelect
                className="min-w-[10rem]"
                options={CATEGORY_OPTIONS}
                value={createCategory}
                onChange={(v) => setCreateCategory(v as KnowledgeCategory)}
              />
              <SearchableSelect
                className="min-w-[9rem]"
                options={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(v) => setVisibility(v as KnowledgeVisibility)}
                searchable={false}
              />
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={publishOnCreate}
                  onChange={(e) => setPublishOnCreate(e.target.checked)}
                />
                Publish immediately
              </label>
            </div>
            <textarea
              className={`min-h-[8rem] w-full ${inputClass} px-3 py-2 text-[14px]`}
              placeholder="Paste authoritative content only — never invent policy"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button
              size="sm"
              onClick={async () => {
                setMsg(null);
                try {
                  const r = await createDoc({
                    title,
                    category: createCategory,
                    visibility,
                    content,
                    publish: publishOnCreate,
                  }).unwrap();
                  setMsg(`Created ${r.id} · ${r.status} v${r.version}`);
                  setTitle("");
                  setContent("");
                  refetch();
                } catch {
                  setMsg("Create failed.");
                }
              }}
            >
              Create
            </Button>
          </section>
        ) : null}

        <section className="fo-desk__panel fo-desk__stack">
          <p className="fo-desk__section-label">Retrieval preview</p>
          <div className="fo-desk__toolbar">
            <input
              className={`min-w-[12rem] flex-1 ${inputClass} px-3 py-2 text-[14px]`}
              placeholder="Test query"
              value={previewQuery}
              onChange={(e) => setPreviewQuery(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                setPreviewResult(null);
                try {
                  const r = await retrieve({
                    query: previewQuery,
                    mode: "ops",
                    limit: 5,
                  }).unwrap();
                  setPreviewResult(
                    `coverage=${r.coverage} conflict=${Boolean(r.possibleConflict)} hits=${r.hits.length}\n` +
                      r.hits
                        .map((h) => `- ${h.title} v${h.version} (${h.category}) score=${h.score}`)
                        .join("\n"),
                  );
                } catch {
                  setPreviewResult("Retrieve failed.");
                }
              }}
            >
              Retrieve
            </Button>
          </div>
          {previewResult ? (
            <pre className="whitespace-pre-wrap text-[12px] text-ink-soft">{previewResult}</pre>
          ) : null}
        </section>

        {isLoading ? (
          <Spinner />
        ) : !data?.items?.length ? (
          <div className="fo-desk__panel">
            <p className="fo-desk__empty">
              No knowledge documents. Create published content before Ava can ground policy answers.
            </p>
          </div>
        ) : (
          <section className="fo-desk__panel fo-desk__panel--flush">
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
                  {paginateItems(data.items, page, pageSize).map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="font-medium">{d.title}</span>{" "}
                        <span className="text-ink-faint">v{d.version}</span>
                      </td>
                      <td>{d.category}</td>
                      <td>
                        <span
                          className={
                            d.status === "PUBLISHED"
                              ? "fo-desk__status fo-desk__status--ok"
                              : "fo-desk__status"
                          }
                        >
                          {d.status}
                        </span>
                      </td>
                      <td>{d.visibility}</td>
                      <td>{d.chunkCount ?? 0}</td>
                      {canWrite ? (
                        <td>
                          <div className="fo-desk__toolbar">
                            {d.status !== "PUBLISHED" ? (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  setMsg(null);
                                  try {
                                    await publishDoc(d.id).unwrap();
                                    setMsg(`Published ${d.title}`);
                                    refetch();
                                  } catch {
                                    setMsg("Publish failed.");
                                  }
                                }}
                              >
                                Publish
                              </Button>
                            ) : null}
                            {d.status === "PUBLISHED" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  setMsg(null);
                                  try {
                                    await archiveDoc(d.id).unwrap();
                                    setMsg(`Archived ${d.title}`);
                                    refetch();
                                  } catch {
                                    setMsg("Archive failed.");
                                  }
                                }}
                              >
                                Archive
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                const next = window.prompt("New version content (required)");
                                if (!next?.trim()) return;
                                setMsg(null);
                                try {
                                  const r = await createVersion({
                                    id: d.id,
                                    content: next,
                                    publish: true,
                                  }).unwrap();
                                  setMsg(`Version ${r.version} published`);
                                  refetch();
                                } catch {
                                  setMsg("Version create failed.");
                                }
                              }}
                            >
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
              pageCount={pageCountFor(data.items.length, pageSize)}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalItems={data.items.length}
              label="Knowledge documents"
            />
          </section>
        )}
      </div>
    </PermissionGate>
  );
}

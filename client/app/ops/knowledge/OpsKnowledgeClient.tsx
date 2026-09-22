"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui";
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
import { OpsSignInGate } from "../_components";
import {
  KnowledgeCreatePanel,
  KnowledgeDocsEmpty,
  KnowledgeDocsTable,
  KnowledgeFilters,
  KnowledgeHeader,
  KnowledgePermissionFallback,
  KnowledgeRetrievePanel,
} from "./_components";

const PAGE_SIZE_DEFAULT = 10;

function MsgBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const warn = /fail/i.test(msg);
  return (
    <p className={`fo-ops__msg${warn ? " fo-ops__msg--warn" : ""}`} role="status">
      <span className="inline-flex items-start gap-2">
        {warn ? (
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky" aria-hidden />
        )}
        <span>{msg}</span>
      </span>
    </p>
  );
}

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
  const [creating, setCreating] = useState(false);
  const [retrieving, setRetrieving] = useState(false);

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
    return <OpsSignInGate />;
  }

  return (
    <PermissionGate
      anyOf={["knowledge:read", "knowledge:write", "ops:dashboard:read"]}
      mode="fallback"
      fallback={<KnowledgePermissionFallback />}
    >
      <div className="fo-ops fo-ops__master-stage">
        <KnowledgeHeader />
        <MsgBanner msg={msg} />

        <KnowledgeFilters
          category={category}
          status={status}
          q={q}
          onCategoryChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          onStatusChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          onQueryChange={(v) => {
            setQ(v);
            setPage(1);
          }}
        />

        {canWrite ? (
          <KnowledgeCreatePanel
            title={title}
            createCategory={createCategory}
            visibility={visibility}
            content={content}
            publishOnCreate={publishOnCreate}
            busy={creating}
            onTitleChange={setTitle}
            onCategoryChange={setCreateCategory}
            onVisibilityChange={setVisibility}
            onContentChange={setContent}
            onPublishChange={setPublishOnCreate}
            onSubmit={async () => {
              setMsg(null);
              setCreating(true);
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
              } finally {
                setCreating(false);
              }
            }}
          />
        ) : null}

        <KnowledgeRetrievePanel
          previewQuery={previewQuery}
          previewResult={previewResult}
          busy={retrieving}
          onQueryChange={setPreviewQuery}
          onRetrieve={async () => {
            setPreviewResult(null);
            setRetrieving(true);
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
            } finally {
              setRetrieving(false);
            }
          }}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !data?.items?.length ? (
          <KnowledgeDocsEmpty />
        ) : (
          <KnowledgeDocsTable
            items={data.items}
            page={page}
            pageSize={pageSize}
            canWrite={canWrite}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onPublish={async (id, docTitle) => {
              setMsg(null);
              try {
                await publishDoc(id).unwrap();
                setMsg(`Published ${docTitle}`);
                refetch();
              } catch {
                setMsg("Publish failed.");
              }
            }}
            onArchive={async (id, docTitle) => {
              setMsg(null);
              try {
                await archiveDoc(id).unwrap();
                setMsg(`Archived ${docTitle}`);
                refetch();
              } catch {
                setMsg("Archive failed.");
              }
            }}
            onNewVersion={async (id) => {
              const next = window.prompt("New version content (required)");
              if (!next?.trim()) return;
              setMsg(null);
              try {
                const r = await createVersion({
                  id,
                  content: next,
                  publish: true,
                }).unwrap();
                setMsg(`Version ${r.version} published`);
                refetch();
              } catch {
                setMsg("Version create failed.");
              }
            }}
          />
        )}
      </div>
    </PermissionGate>
  );
}

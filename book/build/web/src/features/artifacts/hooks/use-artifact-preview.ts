import { useEffect, useRef, useState } from "react";
import type { Artifacts, Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import { api } from "@/lib/api";
import { readerMessage } from "../lib/presentation.js";
import { boardReferenceVersions, loadBoardReferences } from "../lib/board-references.js";
import type { ReworkOperation } from "../components/ReworkPanel";

/** 产物预览加载、放大对话框与返工确认状态。 */
export function useArtifactPreview(id: string, project: ProjectDetail | null, stage: Stage, version: number | null, onVersionChange: (v: number | null) => void) {
  const path = `/api/projects/${encodeURIComponent(id)}`;
  const [preview, setPreview] = useState<{ version: number; stage: Stage; value: unknown } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [references, setReferences] = useState<{
    path: string; version: number; bibleVersion: number; scriptVersion: number;
    script: Artifacts["script"] | null; bible: Artifacts["bible"] | null;
  } | null>(null);
  const [confirm, setConfirm] = useState<{ operation: ReworkOperation; reviseFrom?: number } | null>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (expanded) previewDialog.current?.showModal(); else previewDialog.current?.close();
  }, [expanded]);
  useEffect(() => { setExpanded(false); setConfirm(null); }, [stage]);

  const versions = project?.stages[stage].versions ?? [];
  const versionsKey = versions.join(",");
  const latestVersion = versions.at(-1) ?? null;
  useEffect(() => { onVersionChange(latestVersion); }, [stage, versionsKey, latestVersion, onVersionChange]);

  useEffect(() => {
    if (version === null) { setPreview(null); setPreviewError(""); return; }
    const controller = new AbortController();
    setPreview(null); setPreviewError("");
    void api<unknown>(`${path}/stages/${stage}/versions/${version}`, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setPreview({ stage, version, value }); })
      .catch(err => { if (!controller.signal.aborted) setPreviewError(err instanceof Error ? readerMessage(err.message) : "读取失败"); });
    return () => controller.abort();
  }, [path, stage, version]);

  const basis = boardReferenceVersions(project, version);
  const bibleVersion = basis?.bible;
  const scriptVersion = basis?.script;
  useEffect(() => {
    setReferences(null);
    if (stage !== "board" || version === null || !bibleVersion || !scriptVersion) return;
    const controller = new AbortController();
    void loadBoardReferences(path, { bible: bibleVersion, script: scriptVersion }, controller.signal).then(value => {
      if (!controller.signal.aborted) setReferences({ path, version, bibleVersion, scriptVersion, ...value });
    }).catch(() => {});
    return () => controller.abort();
  }, [path, stage, version, bibleVersion, scriptVersion]);

  const visiblePreview = preview?.stage === stage && preview.version === version ? preview : null;
  const visibleReferences = stage === "board" && references?.path === path && references.version === version
    && references.bibleVersion === bibleVersion && references.scriptVersion === scriptVersion ? references : null;

  return {
    path, preview, previewError, expanded, setExpanded, script: visibleReferences?.script ?? null, bible: visibleReferences?.bible ?? null,
    confirm, setConfirm, previewDialog, versions, visiblePreview,
  };
}

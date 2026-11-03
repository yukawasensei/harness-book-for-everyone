import { useEffect, useRef, useState } from "react";
import type { Artifacts, Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail } from "../../../../../src/server/protocol.js";
import { api } from "@/lib/api";
import { readerMessage } from "../lib/presentation.js";
import type { ReworkOperation } from "../components/ReworkPanel";

/** 产物预览加载、放大对话框与返工确认状态。 */
export function useArtifactPreview(id: string, project: ProjectDetail | null, stage: Stage, version: number | null, onVersionChange: (v: number | null) => void) {
  const path = `/api/projects/${encodeURIComponent(id)}`;
  const [preview, setPreview] = useState<{ version: number; stage: Stage; value: unknown } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [script, setScript] = useState<Artifacts["script"] | null>(null);
  const [bible, setBible] = useState<Artifacts["bible"] | null>(null);
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

  const adoptedBible = project?.stages.bible.adopted_version;
  const adoptedScript = project?.stages.script.adopted_version;
  useEffect(() => {
    setBible(null); setScript(null);
    if (stage !== "storyboard" || !adoptedBible || !adoptedScript) return;
    const controller = new AbortController();
    void Promise.all([
      api<Artifacts["bible"]>(`${path}/stages/bible/versions/${adoptedBible}`, undefined, controller.signal),
      api<Artifacts["script"]>(`${path}/stages/script/versions/${adoptedScript}`, undefined, controller.signal),
    ]).then(([nextBible, nextScript]) => {
      if (!controller.signal.aborted) { setBible(nextBible); setScript(nextScript); }
    }).catch(() => {});
    return () => controller.abort();
  }, [path, stage, adoptedBible, adoptedScript]);

  const visiblePreview = preview?.stage === stage && preview.version === version ? preview : null;

  return {
    path, preview, previewError, expanded, setExpanded, script, bible,
    confirm, setConfirm, previewDialog, versions, visiblePreview,
  };
}

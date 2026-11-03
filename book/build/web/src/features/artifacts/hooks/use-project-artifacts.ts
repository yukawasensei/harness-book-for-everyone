import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, ServerConfig } from "../../../../../src/server/protocol.js";
import { api, connectProject, queryKeys } from "@/lib/api";
import { appendEvent, type TimelineRow } from "@/features/chat";
import {
  rememberSelectedStage, restoreSelectedStage,
} from "@/features/sessions";
import { demoRevisionNotice, readerMessage, runRequestText } from "../lib/presentation.js";

const errorMessage = (error: unknown) => error instanceof Error ? readerMessage(error.message) : "操作失败";

/** 右栏：阶段选择、SSE、审阅动作与运行提交。 */
export function useProjectArtifacts(id: string, config: ServerConfig) {
  const client = useQueryClient();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [stage, setStage] = useState<Stage>(() => restoreSelectedStage(id));
  const [version, setVersion] = useState<number | null>(null);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const feed = useRef<ReturnType<typeof connectProject> | null>(null);

  useEffect(() => { rememberSelectedStage(id, stage); }, [id, stage]);
  useEffect(() => {
    const live = connectProject(id, {
      state: next => {
        setProject(next);
        client.setQueryData(queryKeys.project(id), next);
      },
      event: event => setRows(current => appendEvent(current, event)),
      connection: () => {},
      error: message => setError(readerMessage(message)),
    });
    feed.current = live;
    return () => { live.close(); feed.current = null; };
  }, [id, client]);

  async function action(operation: () => Promise<void>) {
    setError(""); setSubmitting(true);
    try { await operation(); return true; }
    catch (err) { setError(errorMessage(err)); return false; }
    finally { await feed.current?.refresh(); setSubmitting(false); }
  }

  function executeRun(reviseFrom?: number, staging?: "resume" | "restart", confirmed = false) {
    return action(async () => {
      const note = reviseFrom === undefined ? "" : project?.stages[stage].reviews?.[reviseFrom]?.note ?? "";
      runRequestText(stage, "", reviseFrom === undefined ? undefined : { version: reviseFrom, note });
      demoRevisionNotice(config.mode === "demo", note, stage);
      await api(`/api/projects/${encodeURIComponent(id)}/stages/${stage}/run`, {
        instructions: "", confirmed, staging,
        ...(reviseFrom === undefined ? {} : { revise_from: reviseFrom }),
      });
    });
  }

  return {
    project, stage, setStage, version, setVersion, rows, error, submitting,
    runningBusy: !!project?.running,
    demo: config.mode === "demo",
    action, executeRun,
  };
}

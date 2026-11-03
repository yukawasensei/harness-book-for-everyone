import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Stage } from "../../../../../src/contracts/index.js";
import type { ProjectDetail, ServerConfig, TimelineItem } from "../../../../../src/server/protocol.js";
import { api, applyProjectEvent, connectProject, endpoints, queryKeys, type Connection } from "@/lib/api";
import { readerMessage } from "@/features/artifacts";
import { appendEvent, type TimelineRow } from "../lib/append-event.js";
import { useSendMessage } from "./use-messages";
import { useTimeline } from "./use-timeline";

const errorMessage = (error: unknown) => error instanceof Error ? readerMessage(error.message) : "操作失败";

const connectionLabel: Record<Connection, string> = {
  connecting: "正在连接", live: "实时事件已连接", polling: "正在重新连接…",
};

/** 中栏：SSE + 时间线 + 发消息 + 审阅。 */
export function useProjectWorkspace(id: string, config: ServerConfig) {
  const client = useQueryClient();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const [liveRows, setLiveRows] = useState<TimelineRow[]>([]);
  const feed = useRef<ReturnType<typeof connectProject> | null>(null);
  const timelineQuery = useTimeline(id, { polling: connection === "polling" });
  const sendMessage = useSendMessage(id);

  useEffect(() => {
    const invalidate = () => {
      void client.invalidateQueries({ queryKey: queryKeys.timeline(id) });
      void client.invalidateQueries({ queryKey: queryKeys.project(id) });
    };
    const live = connectProject(id, {
      state: next => {
        setProject(next);
        client.setQueryData(queryKeys.project(id), next);
      },
      event: event => {
        applyProjectEvent(client, id, event);
        // 运行中用 liveRows 流式展示；结束后交回时间线，避免与 transcript 重复。
        if (event.type === "run_started") {
          setLiveRows(() => appendEvent([], event));
        } else if (event.type === "run_ended" || (event.type === "project_state" && !event.project.running)) {
          setLiveRows([]);
        } else if (event.type !== "timeline_item" && event.type !== "project_state") {
          setLiveRows(current => appendEvent(current, event));
        }
      },
      connection: setConnection,
      error: message => setError(readerMessage(message)),
      poll: () => { void client.invalidateQueries({ queryKey: queryKeys.timeline(id) }); },
      resync: invalidate,
    });
    feed.current = live;
    return () => { live.close(); feed.current = null; };
  }, [id, client]);

  const items: TimelineItem[] = timelineQuery.data?.items ?? [];
  const placeholder = project?.running
    ? "正在运行…"
    : Object.values(project?.stages ?? {}).some(s => s.status === "pending_review")
      ? "对这一版提修改意见，例如：把第二场改得更紧张"
      : "描述你想拍的短片…";

  async function send(text: string) {
    setError("");
    try {
      await sendMessage.mutateAsync(text);
      await feed.current?.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function abort() {
    void api(`/api/projects/${encodeURIComponent(id)}/abort`, {})
      .then(() => feed.current?.refresh())
      .catch(err => setError(errorMessage(err)));
  }

  async function adopt(stage: Stage, version: number) {
    setError("");
    try {
      await endpoints.projects.review(id, stage, "adopt", { version });
      await feed.current?.refresh();
      void client.invalidateQueries({ queryKey: queryKeys.timeline(id) });
      void client.invalidateQueries({ queryKey: queryKeys.project(id) });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function discard(stage: Stage, version: number) {
    setError("");
    try {
      await endpoints.projects.review(id, stage, "discard", { version });
      await feed.current?.refresh();
      void client.invalidateQueries({ queryKey: queryKeys.timeline(id) });
      void client.invalidateQueries({ queryKey: queryKeys.project(id) });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function requestChanges(stage: Stage, version: number, note: string) {
    setError("");
    try {
      await send(note);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return {
    project, connection, error, liveRows, items, placeholder,
    loading: timelineQuery.isLoading,
    sending: sendMessage.isPending,
    running: !!project?.running,
    connectionLabel: `${connectionLabel[connection]} · ${config.mode === "demo" ? "演示" : "模型"}`,
    send, abort, adopt, discard, requestChanges,
  };
}

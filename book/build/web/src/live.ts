import type { ProjectDetail, ProjectEvent } from "../../src/server/protocol.js";
import { authenticatedEvents } from "./auth-events.js";
import { api, getAccessToken } from "./api.js";

export type Connection = "connecting" | "live" | "polling";
interface FeedHandlers {
  state: (project: ProjectDetail) => void;
  event: (event: ProjectEvent) => void;
  connection: (connection: Connection) => void;
  error: (message: string) => void;
}
export interface EventConnection {
  onmessage: ((event: MessageEvent<string>) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  close: () => void;
}

/** EventSource 自己重连；出错期间轮询快照。事件不重放，缺失的文本不补造。 */
export function connectProject(
  id: string, handlers: FeedHandlers,
  options: {
    open?: (url: string) => EventConnection;
    read?: (url: string, signal: AbortSignal) => Promise<ProjectDetail>;
    pollMs?: number;
  } = {},
) {
  const path = `/api/projects/${encodeURIComponent(id)}`;
  const controller = new AbortController();
  const read = options.read ?? ((url, signal) => api<ProjectDetail>(url, undefined, signal));
  let disposed = false, generation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastId = 0;
  async function refresh() {
    const startedAt = ++generation;
    try {
      const project = await read(path, controller.signal);
      // 晚到的轮询不能覆盖更新的 SSE 快照或更新的请求。
      if (!disposed && startedAt === generation) handlers.state(project);
    } catch (error) {
      if (!disposed) handlers.error(error instanceof Error ? error.message : "无法读取项目");
    }
  }
  function poll() {
    if (!timer) timer = setInterval(() => { void refresh(); }, options.pollMs ?? 2000);
    void refresh();
  }
  handlers.connection("connecting");
  poll();
  const source: EventConnection = (options.open ?? (url => getAccessToken() ? authenticatedEvents(url) : new EventSource(url)))(`${path}/events`);
  source.onmessage = message => {
    if (disposed) return;
    const sequence = Number(message.lastEventId);
    if (!Number.isSafeInteger(sequence) || sequence <= lastId) return;
    let event: ProjectEvent;
    try { event = JSON.parse(message.data) as ProjectEvent; }
    catch { source.onerror?.(new Event("error")); return; }
    lastId = sequence;
    if (event.type === "project_state") {
      generation++;
      handlers.state(event.project);
      clearInterval(timer); timer = undefined;
      handlers.connection("live");
    }
    handlers.event(event);
  };
  source.onerror = () => {
    if (disposed) return;
    // 服务重启会从 1 重新编号；新连接先收快照，没有历史重放。
    lastId = 0;
    handlers.connection("polling");
    poll();
  };
  return {
    refresh,
    close() { disposed = true; controller.abort(); clearInterval(timer); source.close(); },
  };
}
